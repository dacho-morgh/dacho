#!/usr/bin/env python3
"""Check that rendered staging and production stacks cannot share state or tags."""

import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def render(compose_file, values):
    env = os.environ.copy()
    env.update(values)
    result = subprocess.run(
        ["docker", "compose", "-f", compose_file, "config", "--format", "json"],
        cwd=ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def mounts(service, kind):
    return {
        item["source"]
        for item in service.get(kind, [])
        if isinstance(item, dict) and "source" in item
    }


def main():
    production = render(
        "docker-compose.prod.yml",
        {
            "IMAGE_TAG": "sha-abcdef0",
            "POSTGRES_PASSWORD": "productiontestpassword",
            "NEXT_PUBLIC_SERVER_URL": "https://production.invalid",
            "PAYLOAD_API_KEY": "productiontestkey",
            "INTERNAL_PROXY_SECRET": "productiontestsecret",
        },
    )
    staging = render(
        "docker-compose.staging.yml",
        {
            "STAGING_IMAGE_SUFFIX": "-sha-1234567",
            "STAGING_POSTGRES_PASSWORD": "stagingtestpassword",
            "STAGING_PUBLIC_URL": "https://staging.invalid",
            "STAGING_PAYLOAD_API_KEY": "stagingtestkey",
            "STAGING_INTERNAL_PROXY_SECRET": "stagingtestsecret",
        },
    )
    assert staging["name"] == "dacho-staging"
    assert staging["name"] != production["name"]

    for service in ("frontend", "backend"):
        stage = staging["services"][service]
        prod = production["services"][service]
        assert stage["image"] == f"ghcr.io/dacho-morgh/dacho/{service}:staging-sha-1234567"
        assert prod["image"] == f"ghcr.io/dacho-morgh/dacho/{service}:sha-abcdef0"
        assert mounts(stage, "secrets").isdisjoint(mounts(prod, "secrets"))
        assert stage["environment"]["DATABASE_URL"] != prod["environment"]["DATABASE_URL"]

    assert mounts(staging["services"]["postgres"], "volumes").isdisjoint(
        mounts(production["services"]["postgres"], "volumes")
    )
    assert mounts(staging["services"]["frontend"], "volumes").isdisjoint(
        mounts(production["services"]["frontend"], "volumes")
    )
    assert set(staging["volumes"]).isdisjoint(production["volumes"])
    assert set(staging["secrets"]).isdisjoint(production["secrets"])

    stage_ports = {
        (port["host_ip"], port["published"])
        for service in staging["services"].values()
        for port in service.get("ports", [])
    }
    prod_ports = {
        (port["host_ip"], port["published"])
        for service in production["services"].values()
        for port in service.get("ports", [])
    }
    assert stage_ports == {("127.0.0.1", "3300"), ("127.0.0.1", "4400")}
    assert stage_ports.isdisjoint(prod_ports)

    floating = render(
        "docker-compose.staging.yml",
        {
            "STAGING_IMAGE_SUFFIX": "",
            "STAGING_POSTGRES_PASSWORD": "stagingtestpassword",
            "STAGING_PUBLIC_URL": "https://staging.invalid",
            "STAGING_PAYLOAD_API_KEY": "stagingtestkey",
            "STAGING_INTERNAL_PROXY_SECRET": "stagingtestsecret",
        },
    )
    for service in ("frontend", "backend"):
        assert floating["services"][service]["image"].endswith("/" + service + ":staging")
    print("Staging Compose isolation: OK")


if __name__ == "__main__":
    main()
