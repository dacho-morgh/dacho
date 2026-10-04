"""Exercise the real deploy script without touching Docker or production data.

Run on Linux: python3 deploy/maintenance/test_deployment.py
"""

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/deploy-production.sh"
TARGET = "2222222" + "2" * 33
OLD = "1111111" + "1" * 33

DRIVER = r'''#!/usr/bin/env python3
import os, sys
from pathlib import Path
command = Path(sys.argv[0]).name
args = sys.argv[1:]
root = Path(os.environ["TEST_ROOT"])
state = root / "state"
target = "2222222" + "2" * 33
old = "1111111" + "1" * 33
scenario = os.environ["TEST_SCENARIO"]
if command == "git":
    if args[0] == "rev-parse": print(target if args[-1] == "origin/main" else old)
    sys.exit(0)
if command == "sleep": sys.exit(0)
if command == "curl":
    url = args[-1]
    if ":9080/" in url: sys.exit(0)
    service = "frontend" if ":3000/" in url else "backend"
    sys.exit(0 if (state / (service + "-ready")).exists() else 1)
with (state / "commands").open("a") as output: output.write(" ".join(args) + "\n")
if args[0] == "manifest": sys.exit(0)
if args[0] == "inspect":
    service = "frontend" if "frontend" in args[1] else "backend"
    print((state / (service + "-revision")).read_text())
    sys.exit(0)
if args[:2] == ["image", "inspect"]:
    image = args[2]
    if "frontend:sha-1111111" in image and not (state / "old-image").exists(): sys.exit(1)
    if "{{.Id}}" in args: print("old-frontend-id" if "frontend" in image else "old-backend-id")
    else: print(target)
    sys.exit(0)
if args[0] == "pull" or (args[0] == "compose" and any(x in args for x in ("stop", "rm", "up"))):
    if not (state / "active").exists():
        print("ERROR: container operation occurred before maintenance was enabled", file=sys.stderr)
        sys.exit(97)
if args[0] == "pull":
    print("Image pull output: " + args[1])
    if "frontend:sha-2222222" in args[1] and scenario != "success": sys.exit(1)
    if "frontend:sha-1111111" in args[1]: (state / "old-image").touch()
    sys.exit(0)
if args[:2] == ["image", "rm"] and "old-frontend-id" in args:
    if not (state / "active").exists(): sys.exit(97)
    (state / "old-image").unlink(missing_ok=True)
if args[0] == "compose":
    if "stop" in args and "frontend" in args: (state / "frontend-ready").unlink(missing_ok=True)
    if "up" in args:
        service = args[-1]
        if service == "frontend" and scenario == "rollback-unhealthy": sys.exit(1)
        (state / (service + "-ready")).touch()
        tag = next(line for line in (root / ".env").read_text().splitlines() if line.startswith("IMAGE_TAG="))
        (state / (service + "-revision")).write_text(target if "2222222" in tag else old)
sys.exit(0)
'''


@unittest.skipUnless(shutil.which("bash") and os.name == "posix", "Requires Linux bash")
class DeploymentTests(unittest.TestCase):
    def run_deployment(self, scenario):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        state = root / "state"
        state.mkdir()
        for name in ("frontend-ready", "backend-ready", "old-image"):
            (state / name).touch()
        for service in ("frontend", "backend"):
            (state / (service + "-revision")).write_text(OLD)
        (root / "scripts").mkdir()
        shutil.copyfile(SCRIPT, root / "scripts/deploy-production.sh")
        (root / ".local/bin").mkdir(parents=True)
        (root / ".env").write_text("IMAGE_TAG=sha-1111111\nPLACEHOLDER=" + "x" * 150 + "\n")
        (root / "docker-compose.prod.yml").touch()
        tools = root / "tools"
        tools.mkdir()
        for name in ("git", "docker", "curl", "sleep"):
            path = tools / name
            path.write_text(DRIVER)
            path.chmod(0o755)
        env = dict(os.environ, HOME=str(root), DACHO_REPO_DIR=str(root),
                   DACHO_MAINTENANCE_DIR=str(state), TEST_ROOT=str(root),
                   TEST_SCENARIO=scenario, PATH=str(tools) + os.pathsep + os.environ["PATH"])
        result = subprocess.run(["bash", str(SCRIPT)], env=env, capture_output=True,
                                text=True, timeout=20)
        self.assertNotIn("ERROR: container operation", result.stdout + result.stderr)
        return root, state, result

    def test_success_shows_page_before_removal_and_restores_website(self):
        root, state, result = self.run_deployment("success")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertFalse((state / "active").exists())
        self.assertIn("IMAGE_TAG=sha-2222222", (root / ".env").read_text())
        actions = (state / "commands").read_text()
        self.assertLess(actions.index("image rm -f old-frontend-id"),
                        actions.index("pull ghcr.io/dacho-morgh/dacho/frontend:sha-2222222"))
        self.assertIn("Image pull output:", (state / "deploy.log").read_text())

    def test_failed_pull_restores_previous_release_and_hides_page(self):
        root, state, result = self.run_deployment("pull-failed")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((state / "active").exists())
        self.assertIn("IMAGE_TAG=sha-1111111", (root / ".env").read_text())
        self.assertIn("Deployment failed; restoring", (state / "deploy.log").read_text())
        self.assertIn("pull ghcr.io/dacho-morgh/dacho/frontend:sha-1111111",
                      (state / "commands").read_text())

    def test_failed_rollback_keeps_page_visible(self):
        _root, state, result = self.run_deployment("rollback-unhealthy")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((state / "active").exists())
        self.assertIn("keeping the update page visible", (state / "deploy.log").read_text())


if __name__ == "__main__":
    unittest.main()
