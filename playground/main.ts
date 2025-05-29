import { createApp } from 'vue'
import App from './App.vue'
// Import from source index.ts (same as built package behavior)
import '../src/index'
 
const app = createApp(App)
app.mount('#app') 