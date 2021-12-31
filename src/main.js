/*
 * @Description: default
 * @version: 1.0.0
 * @Author: Maunsell Zhang
 * @Date: 2021-12-31 14:46:10
 * @LastEditors: Maunsell Zhang
 * @LastEditTime: 2021-12-31 16:44:48
 */
import Vue from 'vue'
import App from './App.vue'


Vue.config.productionTip = false

new Vue({
  render: h => h(App)
}).$mount('#app')
