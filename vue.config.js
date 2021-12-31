module.exports = {
  publicPath: './',
  devServer: {
    open: true,
    disableHostCheck: true,
  },
  transpileDependencies: [
    'vue-echarts',
    'resize-detector'
  ]
}