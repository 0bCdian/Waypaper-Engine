<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { withBase, useData } from "vitepress";

const { isDark } = useData();
const scriptLoaded = ref(false);
const specUrl = computed(() => withBase("/openapi.yaml"));
const theme = computed(() => (isDark.value ? "dark" : "light"));

let script: HTMLScriptElement | null = null;

onMounted(() => {
	script = document.createElement("script");
	script.type = "module";
	script.src = "https://unpkg.com/rapidoc@9.3.8/dist/rapidoc-min.js";
	script.onload = () => {
		scriptLoaded.value = true;
	};
	document.head.appendChild(script);
});

onBeforeUnmount(() => {
	script?.remove();
});
</script>

<template>
	<div class="open-api-doc">
		<p v-if="!scriptLoaded" class="api-loading">Loading the interactive spec…</p>
		<rapi-doc
			v-show="scriptLoaded"
			:spec-url="specUrl"
			render-style="read"
			:theme="theme"
			:allow-spec-url-load="true"
			:allow-search="true"
			:allow-try="false"
		/>
	</div>
</template>

<style scoped>
.open-api-doc {
	margin: 0 -1.5rem;
}

.api-loading {
	padding: 1rem 1.5rem;
	color: var(--vp-c-text-2);
}
</style>
