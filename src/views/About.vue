<template>
  <div class="container fade-in">
    <section class="about-hero">
      <h1>Built for <span class="gradient-text">Performance</span></h1>
      <p>This FE source base is engineered with modern best practices, focusing on speed, developer experience, and stunning aesthetics.</p>
    </section>

    <div class="stack-grid">
      <div class="card glass-card">
        <h3>⚡ Vite + Vue 3</h3>
        <p>The fastest way to build modern web applications with a reactive core.</p>
      </div>

      <div class="card glass-card">
        <h3>🛡️ TypeScript</h3>
        <p>End-to-end type safety for a more reliable development workflow.</p>
      </div>

      <div class="card glass-card">
        <h3>🍍 Pinia</h3>
        <p>Next-generation state management for Vue apps. Lightweight and intuitive.</p>
      </div>

      <div class="card glass-card">
        <h3>🎨 Vanilla CSS</h3>
        <p>No extra weight from CSS frameworks. Just clean, optimized, and beautiful styles.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-hero {
  text-align: center;
  margin-bottom: 4rem;
  padding-top: 2rem;
}

.gradient-text {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

h3 {
  margin-bottom: 0.75rem;
}
</style>
