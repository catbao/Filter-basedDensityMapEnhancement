<script lang="ts">

export default {
  emits: ['update'],
  data() {
    return {
      settingForm: {
        dataset: 'PersonActivity',
        width: 900,
        height: 600,
        //gridWidth: 200,
        //gridHeight: 200,
        type: 'log',
        filter: 'guided',
        colormap: 'Greys',
        filterParams: {
          sigma: 2,
          win_size: 20,
          tau: 0.16,
        },
        detailFactor: 3,
      },
      datasets: ['NYC_Taxis', 'HR_Diagram', 'UK_Road_Safety', 'arXiv', 'PersonActivity', 'BostonMarathon', 'Synthetic', 'clustMe9', 'clustMe15'],
      transformTypes: ['linear', 'log', 'pow', 'sqrt', 'cbrt',],
      colormaps: ['Greys', 'Plasma', 'Viridis', 'Inferno', 'Turbo', 'Cividis', '2D_CIELch']
    }
  },
  mounted() {
    this.$emit("update", this.settingForm);
  }
}
</script>

<template>
  <el-aside>
    <el-form
      label-position="top"
      label-width="100px"
      :model="settingForm"
      style="max-width: 350px; padding: 15px;"
    >
      <el-form-item label="Dataset">
        <el-select v-model="settingForm.dataset" placeholder="Select" class="fulfill-width">
          <el-option
            v-for="item in datasets"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Display size">
        <el-col :span="11">
          <el-input
            v-model="settingForm.width"
            type="number"
            step="100"
            label="Display width"
            placeholder="Display width"
            />
        </el-col>
        <el-col class="text-center" :span="2"> × </el-col>
        <el-col :span="11">
          <el-input
            v-model="settingForm.height"
            type="number"
            step="100"
            label="Display height"
            placeholder="Display height"
            />
        </el-col>
      </el-form-item>
<!--
      <el-form-item label="Grid size">
        <el-col :span="11">
          <el-input
            v-model="settingForm.gridWidth"
            type="number"
            label="Display width"
            placeholder="Display width"
            />
        </el-col>
        <el-col class="text-center" :span="2"> × </el-col>
        <el-col :span="11">
          <el-input
            v-model="settingForm.gridHeight"
            type="number"
            label="Display height"
            placeholder="Display height"
            />
        </el-col>
      </el-form-item>
-->
      <el-form-item label="Transformation">
        <el-select v-model="settingForm.type" placeholder="Select" class="fulfill-width">
          <el-option
            v-for="item in transformTypes"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Colormap">
        <el-select v-model="settingForm.colormap" placeholder="Select" class="fulfill-width">
          <el-option
            v-for="item in colormaps"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Detail enhancement factor - ω">
        <el-slider
          v-model="settingForm.detailFactor"
          :step="0.01"
          :max="10"
          show-input />
      </el-form-item>
      <el-form-item label="Filter type">
        <el-radio-group v-model="settingForm.filter">
          <el-radio label="gaussian" size="large">Gaussian Filter</el-radio>
          <el-radio label="guided" size="large">Guided Filter</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="Filter parameters - Window size">
        <el-slider v-model="settingForm.filterParams.win_size" :min="1" :max="40" show-input />
      </el-form-item>
      <template v-if="settingForm.filter === 'gaussian'">
        <el-form-item label="Filter parameters - σ">
          <el-slider v-model="settingForm.filterParams.sigma" :step="0.01" :max="10" show-input />
        </el-form-item>
      </template>
      <template v-else-if="settingForm.filter === 'guided'">
        <el-form-item label="Filter parameters - τ">
          <el-slider
            v-model="settingForm.filterParams.tau"
            :step="0.01"
            :max="5"
            show-input />
        </el-form-item>
      </template>
      <template v-else>
      </template>
      <el-form-item>
        <el-button type="primary" @click="$emit('update', settingForm)" class="fulfill-width">
          <el-icon>
            <i-ep-circle-check />
          </el-icon>
          <span>Apply</span> 
        </el-button>
      </el-form-item>
    </el-form>
  </el-aside>
</template>

<style scoped>
  .el-aside {
    background-color: #eee;
    border-right: 7px solid #aaa;
    width: 380px;
    height: calc(100vh - 62px);
  }

  .fulfill-width {
    width: 100%;
  }

  .text-center {
    text-align: center;
  }
</style>