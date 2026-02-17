# Pull Down Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/FezVrasta/pull-down-card)](https://github.com/FezVrasta/pull-down-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An iOS-style pull-down drawer card for Home Assistant. Swipe down from the handle to reveal additional cards in a beautiful overlay drawer.

![Pull Down Card Demo](https://raw.githubusercontent.com/FezVrasta/pull-down-card/main/demo.gif)

## Features

- iOS-style pull-down gesture interaction
- Smooth animations with backdrop blur
- Works with any Home Assistant card
- Visual editor support
- Auto-close on button tap (optional)
- Mouse and touch support
- Fully customizable appearance

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click on the three dots in the top right corner
3. Select "Custom repositories"
4. Add this repository URL: `https://github.com/FezVrasta/pull-down-card`
5. Select "Lovelace" as the category
6. Click "Add"
7. Search for "Pull Down Card" and install it
8. Restart Home Assistant

### Manual Installation

1. Download `pull-down-card.js` from the [latest release](https://github.com/FezVrasta/pull-down-card/releases)
2. Copy it to your `config/www` folder
3. Add the resource in your Lovelace configuration:

```yaml
resources:
  - url: /local/pull-down-card.js
    type: module
```

## Configuration

### Using the Visual Editor

The card supports Home Assistant's visual editor. Simply add a new card and search for "Pull Down Card".

### YAML Configuration

```yaml
type: custom:pull-down-card
main_card:
  type: weather-forecast
  entity: weather.home
drawer_cards:
  - type: entities
    entities:
      - light.living_room
      - light.bedroom
  - type: thermostat
    entity: climate.home
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `main_card` | object | **required** | Card configuration for main content |
| `drawer_cards` | array | **required** | Array of card configurations for drawer |
| `handle_color` | string | `rgba(255,255,255,0.4)` | Color of the pull handle |
| `handle_height` | number | `24` | Height of the handle zone in pixels |
| `drawer_background` | string | `rgba(0,0,0,0.5)` | Background color of the drawer |
| `drawer_blur` | number | `20` | Backdrop blur amount in pixels |
| `animation_duration` | number | `300` | Animation duration in milliseconds |
| `swipe_threshold` | number | `50` | Minimum swipe distance to trigger open/close |
| `auto_close_on_tap` | boolean | `true` | Auto-close drawer when tapping buttons inside |

### Full Example

```yaml
type: custom:pull-down-card
main_card:
  type: picture-elements
  image: /local/room.jpg
  elements:
    - type: state-label
      entity: sensor.temperature
      style:
        top: 10%
        left: 10%
drawer_cards:
  - type: horizontal-stack
    cards:
      - type: button
        entity: light.lamp_1
        tap_action:
          action: toggle
      - type: button
        entity: light.lamp_2
        tap_action:
          action: toggle
  - type: entities
    entities:
      - entity: climate.thermostat
      - entity: fan.ceiling_fan
handle_color: rgba(255, 255, 255, 0.6)
handle_height: 30
drawer_background: rgba(0, 0, 0, 0.7)
drawer_blur: 25
animation_duration: 350
auto_close_on_tap: true
```

## Usage Tips

- The pull handle appears at the top of the main card - swipe down to reveal the drawer
- Tap anywhere on the dark overlay to close the drawer
- Press Escape to close the drawer
- When `auto_close_on_tap` is enabled, tapping any button in the drawer will automatically close it

## Development

```bash
# Clone the repository
git clone https://github.com/FezVrasta/pull-down-card.git

# Copy the card to your HA config
cp dist/pull-down-card.js /path/to/homeassistant/config/www/
```

## Support

If you find this card useful, consider starring the repository!

Found a bug or have a feature request? [Open an issue](https://github.com/FezVrasta/pull-down-card/issues).

## License

MIT License - see [LICENSE](LICENSE) for details.
