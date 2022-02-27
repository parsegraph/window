const {webpackConfig, relDir} = require("./webpack.common");

module.exports = {
  entry: {
    main: relDir("src/window.ts"),
    demo: relDir("src/demo.ts"),
  },
  ...webpackConfig(false),
};
