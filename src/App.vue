<script lang="ts">
import SettingSidebar from './components/SettingSidebar.vue'
import DensityMapViewer from './components/DensityMapViewer.vue'

import 'element-plus/es/components/loading/style/css'
import { ElLoading } from 'element-plus'

export default {
  components: {
    SettingSidebar,
    DensityMapViewer
  },
  data() {
    return {
      settings: {},
    }
  },
  methods: {
    updateDensityMap(settings: object) {
      this.settings = settings;
      (this.$refs.viewer as typeof DensityMapViewer).createDensityMapWithNewParams();
    }
  },
  mounted() {
    ElLoading.service({
      lock: true,
      text: 'Loading OpenCV.js',
      background: 'rgba(0, 0, 0, 0.7)',
    })
  }
}
</script>

<template>
  <el-container>
    <el-header>
      <img alt="Density logo" class="logo" src="./assets/density-plot-logo.svg" width="65" height="65" />
      <span class="title">Bi-scale Density Plots</span>
    </el-header>
    <el-container>
      <SettingSidebar @update="updateDensityMap"/>
      <DensityMapViewer :params="settings" ref="viewer"/>
    </el-container>
  </el-container>
</template>

<style scoped>
  .el-header {
    background-color: #000;
    color: var(--el-text-color-primary);
    line-height: 63px;
    padding-left: 5px;
  }

  .title {
    position: absolute;
    margin-left: 5px;
    font-size: 20pt;
    color: #dedede;
    user-select: none;
  }
</style>