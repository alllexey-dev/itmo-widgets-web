// Order matters: reset, component styles, then the theme's tokens.
// The theme uses the system font stack, so no font files are loaded.
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '../themes/widgets/widgets.css';
import './global.css';
