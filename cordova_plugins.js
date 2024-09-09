cordova.define('cordova/plugin_list', function(require, exports, module) {
  module.exports = [
    {
      "id": "cordova-plugin-canvas2image-updated.Canvas2ImagePlugin",
      "file": "plugins/cordova-plugin-canvas2image-updated/www/Canvas2ImagePlugin.js",
      "pluginId": "cordova-plugin-canvas2image-updated",
      "clobbers": [
        "window.canvas2ImagePlugin"
      ]
    }
  ];
  module.exports.metadata = {
    "cordova-plugin-canvas2image-updated": "1.2.0"
  };
});