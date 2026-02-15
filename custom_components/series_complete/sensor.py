"""Sensor platform for Series Complete."""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.sensor import (
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SeriesCompleteConfigEntry, SeriesCompleteCoordinator


@dataclass(frozen=True, kw_only=True)
class SeriesCompleteSensorDescription(SensorEntityDescription):
    """Describe a Series Complete sensor."""

    value_fn: Callable[[dict[str, Any]], Any]


SENSORS: tuple[SeriesCompleteSensorDescription, ...] = (
    SeriesCompleteSensorDescription(
        key="total",
        translation_key="total_series",
        native_unit_of_measurement="series",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:television",
        value_fn=lambda data: data.get("total", 0),
    ),
    SeriesCompleteSensorDescription(
        key="complete",
        translation_key="complete_series",
        native_unit_of_measurement="series",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:check-circle",
        value_fn=lambda data: data.get("complete", 0),
    ),
    SeriesCompleteSensorDescription(
        key="incomplete",
        translation_key="incomplete_series",
        native_unit_of_measurement="series",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:alert-circle",
        value_fn=lambda data: data.get("incomplete", 0),
    ),
    SeriesCompleteSensorDescription(
        key="critical",
        translation_key="critical_series",
        native_unit_of_measurement="series",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:alert",
        value_fn=lambda data: data.get("critical", 0),
    ),
    SeriesCompleteSensorDescription(
        key="completion",
        translation_key="completion_rate",
        native_unit_of_measurement="%",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:percent",
        value_fn=lambda data: data.get("completion_pct", 0.0),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: SeriesCompleteConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Series Complete sensors from a config entry."""
    coordinator: SeriesCompleteCoordinator = entry.runtime_data
    async_add_entities(
        SeriesCompleteSensor(coordinator, description) for description in SENSORS
    )


class SeriesCompleteSensor(
    CoordinatorEntity[SeriesCompleteCoordinator], SensorEntity
):
    """Representation of a Series Complete sensor."""

    entity_description: SeriesCompleteSensorDescription
    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SeriesCompleteCoordinator,
        description: SeriesCompleteSensorDescription,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = (
            f"{coordinator.config_entry.entry_id}_{description.key}"
        )
        self._attr_device_info = {
            "identifiers": {(DOMAIN, coordinator.config_entry.entry_id)},
            "name": "Series Complete for Plex",
            "manufacturer": "Andreas Wendorf",
            "model": "Series Complete",
            "sw_version": "2.6.4",
            "configuration_url": f"http://{coordinator._host}:{coordinator._port}",
        }

    @property
    def native_value(self) -> Any:
        """Return the sensor value."""
        if self.coordinator.data is None:
            return None
        return self.entity_description.value_fn(self.coordinator.data)
