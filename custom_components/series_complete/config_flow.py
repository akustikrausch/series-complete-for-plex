"""Config flow for Series Complete integration."""
from __future__ import annotations

import logging
from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

try:
    from homeassistant.helpers.service_info.hassio import HassioServiceInfo
except ImportError:
    from homeassistant.components.hassio import HassioServiceInfo
from homeassistant.const import CONF_HOST, CONF_PORT, CONF_SCAN_INTERVAL
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DEFAULT_HOST, DEFAULT_PORT, DEFAULT_SCAN_INTERVAL, DOMAIN

_LOGGER = logging.getLogger(__name__)

ADDON_PORT = 3000
ADDON_SLUG = "series-complete-plex"
# Third-party HA apps get a hash-based hostname: {sha1(repo_url)[:8]}-{slug}
# Hash for https://github.com/akustikrausch/series-complete-for-plex = e81ba94f
ADDON_HASH_PREFIX = "e81ba94f"
FALLBACK_HOSTNAMES = [
    f"{ADDON_HASH_PREFIX}-{ADDON_SLUG}",
    f"local-{ADDON_SLUG}",
    ADDON_SLUG,
]


class SeriesCompleteConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Series Complete."""

    VERSION = 1

    _hassio_discovery: HassioServiceInfo | None = None
    _discovered_host: str = DEFAULT_HOST
    _discovered_port: int = DEFAULT_PORT

    async def async_step_hassio(
        self, discovery_info: HassioServiceInfo
    ) -> ConfigFlowResult:
        """Handle Supervisor app discovery."""
        _LOGGER.info(
            "Received hassio discovery: slug=%s", discovery_info.slug
        )

        self._discovered_host = discovery_info.config.get("host", DEFAULT_HOST)
        self._discovered_port = discovery_info.config.get("port", ADDON_PORT)

        await self.async_set_unique_id(f"hassio_{discovery_info.slug}")
        self._abort_if_unique_id_configured(
            updates={
                CONF_HOST: self._discovered_host,
                CONF_PORT: self._discovered_port,
            }
        )

        self._hassio_discovery = discovery_info
        return await self.async_step_hassio_confirm()

    async def async_step_hassio_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Confirm Supervisor app discovery."""
        if user_input is not None:
            return self.async_create_entry(
                title="Series Complete for Plex",
                data={
                    CONF_HOST: self._discovered_host,
                    CONF_PORT: self._discovered_port,
                    CONF_SCAN_INTERVAL: DEFAULT_SCAN_INTERVAL,
                },
            )

        return self.async_show_form(
            step_id="hassio_confirm",
            description_placeholders={
                "addon": "Series Complete for Plex",
                "host": self._discovered_host,
                "port": str(self._discovered_port),
            },
        )

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle manual configuration."""
        errors: dict[str, str] = {}

        if user_input is not None:
            host = user_input[CONF_HOST]
            port = user_input[CONF_PORT]

            if await self._validate_connection(host, port):
                await self.async_set_unique_id(f"manual_{host}_{port}")
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title=f"Series Complete ({host}:{port})",
                    data={
                        CONF_HOST: host,
                        CONF_PORT: port,
                        CONF_SCAN_INTERVAL: user_input.get(
                            CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
                        ),
                    },
                )
            errors["base"] = "cannot_connect"

        # Try auto-detection for app
        detected = await self._detect_app()
        default_host = detected[0] if detected else DEFAULT_HOST
        default_port = detected[1] if detected else DEFAULT_PORT

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_HOST, default=default_host): str,
                    vol.Required(CONF_PORT, default=default_port): int,
                    vol.Optional(
                        CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL
                    ): vol.All(vol.Coerce(int), vol.Range(min=60, max=86400)),
                }
            ),
            errors=errors,
        )

    async def _validate_connection(self, host: str, port: int) -> bool:
        """Test connection to the Series Complete API."""
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                f"http://{host}:{port}/api/test-connection",
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return resp.status == 200
        except (aiohttp.ClientError, TimeoutError):
            return False

    async def _detect_app(self) -> tuple[str, int] | None:
        """Try to detect the app on common hostnames."""
        session = async_get_clientsession(self.hass)
        for hostname in FALLBACK_HOSTNAMES:
            try:
                async with session.get(
                    f"http://{hostname}:{ADDON_PORT}/api/test-connection",
                    timeout=aiohttp.ClientTimeout(total=3),
                ) as resp:
                    if resp.status == 200:
                        return (hostname, ADDON_PORT)
            except (aiohttp.ClientError, TimeoutError):
                continue
        return None
