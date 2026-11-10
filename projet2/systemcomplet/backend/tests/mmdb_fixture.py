"""Petite base MMDB (format MaxMind DB v2, IPv4) écrite pour les tests de géolocalisation, au même schéma que la
base DB-IP « City Lite » : continent, country, subdivisions, city (noms en/fr)."""

from __future__ import annotations

import ipaddress
import struct
from typing import Any


class _U16(int):
    pass


class _U64(int):
    pass


def _control(type_num: int, size: int) -> bytes:
    if size < 29:
        first, ext = size, b""
    elif size < 29 + 256:
        first, ext = 29, bytes([size - 29])
    elif size < 285 + 65536:
        first, ext = 30, (size - 285).to_bytes(2, "big")
    else:
        first, ext = 31, (size - 65821).to_bytes(3, "big")
    if type_num <= 7:
        return bytes([(type_num << 5) | first]) + ext
    return bytes([first, type_num - 7]) + ext


def _encode(value: Any) -> bytes:
    if isinstance(value, bool):
        return _control(14, int(value))
    if isinstance(value, _U16):
        payload = int(value).to_bytes(2, "big").lstrip(b"\x00")
        return _control(5, len(payload)) + payload
    if isinstance(value, int):
        payload = value.to_bytes(8, "big").lstrip(b"\x00")
        return _control(6 if value < 2**32 else 9, len(payload)) + payload
    if isinstance(value, float):
        return _control(3, 8) + struct.pack(">d", value)
    if isinstance(value, str):
        raw = value.encode("utf-8")
        return _control(2, len(raw)) + raw
    if isinstance(value, dict):
        return _control(7, len(value)) + b"".join(_encode(k) + _encode(v) for k, v in value.items())
    if isinstance(value, list):
        return _control(11, len(value)) + b"".join(_encode(v) for v in value)
    raise TypeError(type(value))


def record(continent: str, country: str, country_fr: str, region: str | None, city: str | None) -> dict[str, Any]:
    data: dict[str, Any] = {
        "continent": {"code": continent, "names": {"en": continent}},
        "country": {"iso_code": country, "names": {"en": country, "fr": country_fr}},
    }
    if region:
        data["subdivisions"] = [{"names": {"en": region}}]
    if city:
        data["city"] = {"names": {"en": city}}
    return data


def build(networks: dict[str, dict[str, Any]], build_epoch: int = 1_790_000_000) -> bytes:
    """networks : « 81.0.0.0/8 » → enregistrement (réseaux disjoints)."""
    data = bytearray()
    nodes: list[list[Any]] = [[None, None]]
    for cidr, rec in networks.items():
        offset = len(data)
        data += _encode(rec)
        net = ipaddress.ip_network(cidr)
        bits = int(net.network_address)
        node = 0
        for i in range(net.prefixlen):
            bit = (bits >> (31 - i)) & 1
            if i == net.prefixlen - 1:
                nodes[node][bit] = ("data", offset)
                break
            entry = nodes[node][bit]
            if entry is None:
                nodes.append([None, None])
                entry = ("node", len(nodes) - 1)
                nodes[node][bit] = entry
            node = entry[1]
    count = len(nodes)

    def value(entry: Any) -> int:
        if entry is None:
            return count
        kind, number = entry
        return number if kind == "node" else count + 16 + number

    tree = b"".join(value(left).to_bytes(3, "big") + value(right).to_bytes(3, "big") for left, right in nodes)
    metadata = {
        "node_count": count,
        "record_size": _U16(24),
        "ip_version": _U16(4),
        "database_type": "DBIP-City-Lite",
        "languages": ["en", "fr"],
        "binary_format_major_version": _U16(2),
        "binary_format_minor_version": _U16(0),
        "build_epoch": _U64(build_epoch),  # libmaxminddb exige un uint64
        "description": {"en": "GLOBUS tests"},
    }
    return tree + b"\x00" * 16 + bytes(data) + b"\xab\xcd\xefMaxMind.com" + _encode(metadata)


SAMPLE = {
    "81.0.0.0/8": record("EU", "FR", "France", "Île-de-France", "Paris"),
    "41.202.0.0/16": record("AF", "CM", "Cameroun", "Littoral", "Douala"),
    "24.48.0.0/16": record("NA", "CA", "Canada", "Québec", "Montréal"),
    "8.8.8.0/24": record("NA", "US", "États-Unis", "California", "Mountain View"),
}
