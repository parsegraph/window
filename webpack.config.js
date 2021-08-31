const path = require("path");

module.exports = {
  externals: {
    "parsegraph-checkglerror":{
      commonjs:"parsegraph-checkglerror",
      commonjs2:"parsegraph-checkglerror",
      amd:"parsegraph-checkglerror",
      root:"parsegraph"
    }
  },
  entry: {
    main:path.resolve(__dirname, "src/window.ts"),
    demo:"./src/demo.ts"
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "parsegraph-window.[name].js",
    globalObject: "this",
    library: "parsegraph",
    libraryTarget: "umd",
  },
  module: {
    rules: [
      {
        test: /\.(js|ts|tsx?)$/,
        exclude: /node_modules/,
        loader: ['babel-loader', 'ts-loader']
      },
      {
        test: /\.(glsl|vs|fs|vert|frag)$/,
        exclude: /node_modules/,
        use: ["ts-shader-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".glsl"],
    modules: [
      path.resolve(__dirname, "src"),
      path.resolve(__dirname, "node_modules"),
    ]
  },
  mode: "development",
  devtool: "eval-source-map",
};
