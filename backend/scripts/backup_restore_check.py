"""Encrypted Mongo logical backup/restore drill.

The archive is encrypted before it touches disk. This script never prints a URI,
password, archive contents, or restored document data. Use a local Mongo target
for restore; it deliberately has no destructive ``--drop`` option.
"""

import argparse
import os
import secrets
import subprocess
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b"GENIEAI-MONGO-AESGCM-1\0"
NONCE_SIZE = 12
TAG_SIZE = 16
CHUNK_SIZE = 1024 * 1024


def _run_backup(uri: str, archive_path: Path, key: bytes) -> None:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    nonce = secrets.token_bytes(NONCE_SIZE)
    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    process = subprocess.Popen(
        ["mongodump", "--uri", uri, "--archive", "--gzip"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        with archive_path.open("wb") as output:
            output.write(MAGIC + nonce)
            while chunk := process.stdout.read(CHUNK_SIZE):
                output.write(encryptor.update(chunk))
            output.write(encryptor.finalize())
            output.write(encryptor.tag)
        stderr = process.stderr.read()
        if process.wait() != 0:
            archive_path.unlink(missing_ok=True)
            raise RuntimeError(f"mongodump failed: {stderr.decode(errors='replace')[-200:]}")
    finally:
        if process.poll() is None:
            process.kill()


def _decrypt(archive_path: Path, key: bytes) -> bytes:
    raw = archive_path.read_bytes()
    if len(raw) < len(MAGIC) + NONCE_SIZE + TAG_SIZE or not raw.startswith(MAGIC):
        raise ValueError("invalid GenieAI backup envelope")
    offset = len(MAGIC)
    nonce = raw[offset:offset + NONCE_SIZE]
    ciphertext = raw[offset + NONCE_SIZE:-TAG_SIZE]
    tag = raw[-TAG_SIZE:]
    decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).decryptor()
    plaintext = decryptor.update(ciphertext)
    plaintext += decryptor.finalize_with_tag(tag)
    return plaintext


def _run_restore(uri: str, archive_path: Path, key: bytes) -> None:
    plaintext = _decrypt(archive_path, key)
    process = subprocess.run(
        ["mongorestore", "--uri", uri, "--archive", "--gzip"],
        input=plaintext,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if process.returncode:
        raise RuntimeError(f"mongorestore failed: {process.stderr.decode(errors='replace')[-200:]}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["backup", "restore"])
    parser.add_argument("--uri", required=True, help="Mongo URI; do not put it in shell history in shared environments")
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--key-file", required=True, type=Path)
    args = parser.parse_args()

    if args.key_file.exists():
        key = args.key_file.read_bytes()
    elif args.mode == "backup":
        key = secrets.token_bytes(32)
        args.key_file.parent.mkdir(parents=True, exist_ok=True)
        args.key_file.write_bytes(key)
        try:
            os.chmod(args.key_file, 0o600)
        except OSError:
            pass
    else:
        raise FileNotFoundError("restore key file does not exist")
    if len(key) != 32:
        raise ValueError("key file must contain exactly 32 raw bytes")

    if args.mode == "backup":
        _run_backup(args.uri, args.archive, key)
        print("Encrypted Mongo backup created")
    else:
        _run_restore(args.uri, args.archive, key)
        print("Mongo restore completed into target URI")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"backup/restore failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
