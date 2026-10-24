"""Check the CI workflow at the boundary where tests and publishing are wired."""

from pathlib import Path
import os
import re
import shutil
import shlex
import subprocess
import tempfile
import textwrap
import unittest


CI = (Path(__file__).resolve().parents[1] / ".github/workflows/ci.yml").read_text()
DATABASE_URL = "postgres://phase0_test:phase0_test_only@127.0.0.1:55439/dacho_phase0_test"
MARKER = "dacho-phase0-disposable-v1"


def block(source: str, key: str, indent: int) -> str:
    """Return a YAML mapping entry and its children at a known indentation."""
    match = re.search(rf"(?m)^{' ' * indent}{re.escape(key)}:\s*(?:#.*)?$", source)
    if match is None:
        return ""
    following = source[match.end():]
    end = re.search(rf"(?m)^ {{0,{indent}}}\S", following)
    return source[match.start():match.end() + (end.start() if end else len(following))]


def step(job: str, name: str) -> str:
    match = re.search(rf"(?m)^      - name: {re.escape(name)}$", job)
    if match is None:
        return ""
    following = job[match.end():]
    end = re.search(r"(?m)^      - ", following)
    return job[match.start():match.end() + (end.start() if end else len(following))]


class CIIsolationContract(unittest.TestCase):
    def test_integration_initializes_guarded_database_before_tests(self):
        integration = block(CI, "integration", 2)
        service = block(integration, "postgres", 6)
        self.assertIn("POSTGRES_USER: phase0_test", service)
        self.assertIn("POSTGRES_PASSWORD: phase0_test_only", service)
        self.assertIn("POSTGRES_DB: dacho_phase0_test", service)
        self.assertRegex(service, r"['\"]?55439:5432['\"]?")

        job_env = block(integration, "env", 4)
        for setting in (
            "PHASE0_ISOLATED_TEST: '1'",
            f"DATABASE_URL: {DATABASE_URL}",
            "PAYLOAD_MEDIA_DIR: ${{ github.workspace }}/.phase0-test-files",
            "PAYLOAD_SECRET: phase0-test-only-payload-secret-do-not-reuse",
            "DOTENV_CONFIG_OVERRIDE: ''",
        ):
            self.assertIn(setting, job_env)

        initialize = step(integration, "Initialize isolated test environment")
        self.assertIn("phase0-test-marker.txt", initialize)
        self.assertIn(MARKER, initialize)
        self.assertIn("scripts/phase0-test-db-init.sql", initialize)
        self.assertIn("docker exec -i", initialize)
        self.assertIn("job.services.postgres.id", initialize)
        self.assertIn("ON_ERROR_STOP=1", initialize)
        self.assertLess(integration.index(initialize), integration.index("- name: Migrate"))
        self.assertLess(integration.index("- name: Migrate"), integration.index("- name: Backend integration tests"))
        self.assertLess(integration.index("- name: Backend integration tests"), integration.index("- name: Frontend integration tests"))

        for name in ("Migrate", "Backend integration tests", "Frontend integration tests"):
            self.assertNotIn("DATABASE_URL:", step(integration, name))

        wrapper = (Path(__file__).resolve().parents[1] / "scripts/phase0-test.ps1").read_text()
        self.assertIn("$env:DOTENV_CONFIG_OVERRIDE = ''", wrapper)
        self.assertNotIn("$env:DOTENV_CONFIG_OVERRIDE = 'false'", wrapper)

    def test_staging_and_main_share_checks_before_publishing(self):
        push = block(block(CI, "on", 0), "push", 2)
        self.assertIn("branches: [main, staging]", push)
        jobs = block(CI, "jobs", 0)
        for name in ("quality", "build-without-database", "integration", "e2e"):
            self.assertTrue(block(jobs, name, 2), name)

        self.assertIn("python3 scripts/test-ci-isolation.py", block(jobs, "quality", 2))
        policy = block(jobs, "branch-policy", 2)
        self.assertIn("runs-on: ubuntu-latest", policy)
        self.assertNotRegex(policy, r"(?m)^    if:")
        self.assertIn('"$GITHUB_EVENT_NAME" == "pull_request"', policy)
        self.assertIn('"$GITHUB_BASE_REF" != "staging"', policy)
        self.assertIn("exit 1", policy)
        publish = block(jobs, "publish-images", 2)
        self.assertIn("needs: [branch-policy, quality, build-without-database, integration, e2e]", publish)
        self.assertIn("refs/heads/main", publish)
        self.assertIn("refs/heads/staging", publish)
        self.assertIn("uses: ./.github/workflows/publish.yml", publish)
        self.assertIn("contents: read", publish)
        self.assertIn("packages: write", publish)

    def test_branch_policy_behavior(self):
        policy = block(block(CI, "jobs", 0), "branch-policy", 2)
        script = textwrap.dedent(policy.split("        run: |\n", 1)[1])
        if os.name == "nt":
            bash = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Git/bin/bash.exe"
            if not bash.exists():
                self.skipTest("Git Bash is unavailable on this Windows host")
        else:
            bash = shutil.which("bash")
            if not bash:
                self.skipTest("bash is unavailable")
        for event, base, expected in (
            ("pull_request", "staging", 0),
            ("pull_request", "main", 1),
            ("push", "", 0),
        ):
            with self.subTest(event=event, base=base):
                env = dict(os.environ, GITHUB_EVENT_NAME=event, GITHUB_BASE_REF=base)
                result = subprocess.run(
                    [str(bash), "--noprofile", "--norc", "-c", script],
                    env=env, capture_output=True, text=True, timeout=10,
                )
                self.assertEqual(result.returncode, expected, result.stderr)

    def test_staging_tags_cannot_publish_production_aliases(self):
        publish = (Path(__file__).resolve().parents[1] / ".github/workflows/publish.yml").read_text()
        self.assertIn("workflow_call:", publish)
        self.assertIn("flavor: latest=false", publish)
        for tag in (
            "type=sha,format=short,prefix=sha-",
            "type=raw,value=main",
            "type=raw,value=latest",
        ):
            self.assertIn(tag + ",enable=${{ github.ref_name == 'main' }}", publish)
        for tag in (
            "type=sha,format=short,prefix=staging-sha-",
            "type=raw,value=staging",
        ):
            self.assertIn(tag + ",enable=${{ github.ref_name == 'staging' }}", publish)

    def test_browser_dependencies_use_the_primary_ubuntu_mirror(self):
        e2e = block(block(CI, "jobs", 0), "e2e", 2)
        mirror = step(e2e, "Use Ubuntu archive mirror for browser dependencies")
        install = step(e2e, "Install Playwright Chromium")
        self.assertIn("s|azure.archive.ubuntu.com|archive.ubuntu.com|g", mirror)
        self.assertLess(e2e.index(mirror), e2e.index(install))
        self.assertIn("playwright install --with-deps chromium", install)

    def test_e2e_owns_a_real_backend_with_ephemeral_credentials(self):
        e2e = block(block(CI, "jobs", 0), "e2e", 2)
        credentials = step(e2e, "Generate ephemeral backend credentials")
        seed = step(e2e, "Migrate + seed content")
        build = step(e2e, "Build")
        run = step(e2e, "Run Playwright")
        self.assertIn("namedCurve: 'prime256v1'", credentials)
        self.assertIn("mode: 0o600", credentials)
        for setting in ("JWT_PRIVATE_KEY_FILE", "SERVICE_ACCOUNT_API_KEY", "PAYLOAD_API_KEY", "INTERNAL_PROXY_SECRET"):
            self.assertIn(setting, credentials)
        self.assertIn("::add-mask::", credentials)
        self.assertIn("seed:service-account", seed)
        self.assertIn("pnpm --filter @dacho/backend build", build)
        self.assertIn("PLAYWRIGHT_BACKEND_SERVER_COMMAND: pnpm --filter @dacho/backend start", run)
        self.assertLess(e2e.index(credentials), e2e.index(seed))
        self.assertLess(e2e.index(seed), e2e.index(build))
        self.assertLess(e2e.index(build), e2e.index(run))
        self.assertIn("if: always()", step(e2e, "Remove ephemeral backend key"))

        config = (Path(__file__).resolve().parents[1] / "apps/frontend/playwright.config.ts").read_text()
        self.assertIn("PLAYWRIGHT_BACKEND_SERVER_COMMAND", config)
        self.assertIn("/health", config)
        self.assertNotIn("reuseExistingServer: true", config)

    def test_mirror_step_rewrites_runner_mirror_lists(self):
        e2e = block(block(CI, "jobs", 0), "e2e", 2)
        mirror = step(e2e, "Use Ubuntu archive mirror for browser dependencies")
        script = textwrap.dedent(mirror.split("        run: |\n", 1)[1])
        bash = (
            Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Git/bin/bash.exe"
            if os.name == "nt" else shutil.which("bash")
        )
        if not bash or not Path(bash).exists():
            self.skipTest("bash is unavailable")
        fixtures = {
            "/etc/apt/sources.list": "deb http://azure.archive.ubuntu.com/ubuntu noble main\n",
            "/etc/apt/sources.list.d/ubuntu.sources": "URIs: mirror+file:/etc/apt/apt-mirrors.txt\n",
            "/etc/apt/apt-mirrors.txt": "http://azure.archive.ubuntu.com/ubuntu/\n",
        }
        with tempfile.TemporaryDirectory() as directory:
            paths = {}
            for index, (original, contents) in enumerate(fixtures.items()):
                target = Path(directory) / f"source-{index}"
                target.write_text(contents)
                paths[original] = target
                script = script.replace(original, shlex.quote(target.as_posix()))
            # Execute the workflow's loop on disposable fixtures, without sudo
            # or any access to the host's /etc/apt configuration.
            script = script.replace("sudo sed -i", "sed -i")
            result = subprocess.run(
                [str(bash), "--noprofile", "--norc", "-c", script],
                capture_output=True, text=True, timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            for original in ("/etc/apt/sources.list", "/etc/apt/apt-mirrors.txt"):
                contents = paths[original].read_text()
                self.assertIn("http://archive.ubuntu.com/ubuntu", contents)
                self.assertNotIn("azure.archive.ubuntu.com", contents)


if __name__ == "__main__":
    unittest.main()
