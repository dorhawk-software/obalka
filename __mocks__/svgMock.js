// Jest stand-in for `*.svg` imports (Metro uses react-native-svg-transformer; jest does not).
// Renders a plain host View so screens importing the logo mount without the SVG toolchain.
const React = require('react');
const { View } = require('react-native');

function SvgMock(props) {
  return React.createElement(View, props);
}

module.exports = SvgMock;
module.exports.default = SvgMock;
module.exports.ReactComponent = SvgMock;
