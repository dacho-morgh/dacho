"""Regression checks for seeding optional media into the upload volume."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "apps/frontend/scripts/seed-bundled-media.sh"


@unittest.skipUnless(os.name == "posix", "Requires a POSIX shell")
class BundledMediaTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.source = self.root / "bundled"
        self.target = self.root / "uploads"
        self.target.mkdir()

    def seed(self):
        return subprocess.run(["sh", str(SCRIPT), str(self.source), str(self.target)],
                              text=True, capture_output=True, timeout=5)

    def test_missing_bundled_directory_does_not_prevent_startup(self):
        result = self.seed()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_empty_bundled_directory_does_not_prevent_startup(self):
        self.source.mkdir()
        result = self.seed()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_copies_files_without_overwriting_existing_uploads(self):
        self.source.mkdir()
        (self.source / "new.jpg").write_text("bundled image")
        (self.source / "edited.jpg").write_text("old image")
        (self.target / "edited.jpg").write_text("edited upload")
        result = self.seed()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.target / "new.jpg").read_text(), "bundled image")
        self.assertEqual((self.target / "edited.jpg").read_text(), "edited upload")

    def test_skips_directories_in_the_bundled_folder(self):
        self.source.mkdir()
        (self.source / "folder").mkdir()
        result = self.seed()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_copy_errors_still_fail_startup(self):
        self.source.mkdir()
        (self.source / "new.jpg").write_text("image")
        self.target.rmdir()
        self.assertNotEqual(self.seed().returncode, 0)


if __name__ == "__main__":
    unittest.main()
