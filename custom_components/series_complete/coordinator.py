"""DataUpdateCoordinator for Series Complete."""
from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any, TypeAlias

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT, CONF_SCAN_INTERVAL
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import (
    DataUpdateCoordinator,
    UpdateFailed,
)

from .const import DEFAULT_SCAN_INTERVAL, DOMAIN

_LOGGER = logging.getLogger(__name__)

SeriesCompleteConfigEntry: TypeAlias = ConfigEntry


class SeriesCompleteCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to fetch data from the Series Complete API."""

    config_entry: SeriesCompleteConfigEntry

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: SeriesCompleteConfigEntry,
    ) -> None:
        """Initialize the coordinator."""
        self._host = config_entry.data[CONF_HOST]
        self._port = config_entry.data[CONF_PORT]
        self._base_url = f"http://{self._host}:{self._port}"
        scan_interval = config_entry.data.get(
            CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
        )

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            config_entry=config_entry,
            update_interval=timedelta(seconds=scan_interval),
        )

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch series data from the Series Complete API."""
        session = async_get_clientsession(self.hass)
        data: dict[str, Any] = {
            "total": 0,
            "complete": 0,
            "incomplete": 0,
            "critical": 0,
            "completion_pct": 0.0,
            "series": [],
        }

        try:
            # Fetch cached series data (POST endpoint)
            async with session.post(
                f"{self._base_url}/api/get-series",
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    series_list = result if isinstance(result, list) else []
                    data["series"] = series_list
                    data["total"] = len(series_list)

                    # Count by analysis status
                    for s in series_list:
                        total_eps = s.get("totalEpisodes", 0)
                        owned_eps = s.get("episode_count", 0)
                        if total_eps and total_eps > 0:
                            pct = (owned_eps / total_eps) * 100
                            if pct >= 100:
                                data["complete"] += 1
                            elif pct < 50:
                                data["critical"] += 1
                            else:
                                data["incomplete"] += 1

                    analyzed = data["complete"] + data["incomplete"] + data["critical"]
                    if analyzed > 0:
                        data["completion_pct"] = round(
                            (data["complete"] / analyzed) * 100, 1
                        )

        except aiohttp.ClientError as err:
            raise UpdateFailed(
                f"Error communicating with Series Complete: {err}"
            ) from err
        except TimeoutError as err:
            raise UpdateFailed(
                f"Timeout communicating with Series Complete: {err}"
            ) from err

        return data
