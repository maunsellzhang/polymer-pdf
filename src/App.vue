<!--
 * @Description: default
 * @version: 1.0.0
 * @Author: Maunsell Zhang
 * @Date: 2021-12-31 14:46:10
 * @LastEditors: Maunsell Zhang
 * @LastEditTime: 2021-12-31 16:45:00
-->
<template>
  <div id="app">
    <div class="pdfs" @click="buildPdf">
      <img src="http://172.18.38.155:10032/1.jpg" width="100%" alt="">
      <img src="http://172.18.38.155:10032/2.jpg" width="100%" alt="">
      <vuepdf v-for="(item, i) in pdfs" :key="i" :src="item.url" style="margin-bottom: 20px"/>
    </div>
  </div>
</template>
<script>
import vuepdf from 'vue-pdf'
import CMapReaderFactory from 'vue-pdf/src/CMapReaderFactory.js'
export default {
  components: { vuepdf },
  data () {
    return {
      pdfs: [],
      okPdf: [],
      index: 1,
    }
  },
  methods: {
    buildPdf() {
      const url = vuepdf.createLoadingTask({
        url: `http://172.18.38.155:10032/${this.index}.pdf`,
        CMapReaderFactory
      })
      this.pdfs.push({
        url
      })
      this.index++
    }
  }
}
</script>
<style lang="less">
#app {
  min-height: 100vh;
  background: #f5f5f5;
  font-size: 0.14rem;
  line-height: 0.2rem;
  color: #333;
}
* {
  box-sizing: border-box;
}
.pdfs{
  width: 880px;
  margin: 0 auto;
}
</style>
