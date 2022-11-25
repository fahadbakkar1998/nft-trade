import { defineConfig } from 'vite'
import path from "path"
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import tailwindcss from 'tailwindcss';
import dfxJson from "./trade_canister/dfx.json"
import fs from "fs"

import inject from '@rollup/plugin-inject'

import inlineImage from "esbuild-plugin-inline-image"

const isDev = process.env["DFX_NETWORK"] !== "ic"

let canisterIds
try {
  canisterIds = JSON.parse(
    fs
      .readFileSync(
        isDev ? "./trade_canister/.dfx/local/canister_ids.json" : "./trade_canister/canister_ids.json",
      )
      .toString(),
  )
} catch (e) {
  console.error(e)
}

// List of all aliases for canisters
// This will allow us to: import { canisterName } from "canisters/canisterName"
const aliases = Object.entries(dfxJson.canisters).reduce(
  (acc, [name, _value]) => {
    // Get the network name, or `local` by default.
    const networkName = process.env["DFX_NETWORK"] ?? "local"
    const outputRoot = path.join(
      __dirname,
      ".dfx",
      networkName,
      "canisters",
      name,
    )

    return {
      ...acc,
      ["canisters/" + name]: path.join(outputRoot, "index" + ".js"),
    }
  },
  {},
)

// Generate canister ids, required by the generated canister code in .dfx/local/canisters/*
// This strange way of JSON.stringifying the value is required by vite
const canisterDefinitions = Object.entries(canisterIds).reduce(
  (acc, [key, val]) => ({
    ...acc,
    [`process.env.${key.toUpperCase()}_CANISTER_ID`]: isDev
      ? JSON.stringify(val.local)
      : JSON.stringify(val.ic),
  }),
  {},
)

// Gets the port dfx is running on from dfx.json
const DFX_PORT = dfxJson.networks.local.bind.split(":")[1]

// https://vitejs.dev/config/
const config = defineConfig({
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.svg'],
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      allow: ["."],
    },
    proxy: {
      // This proxies all http requests made to /api to our running dfx instance
      "/api": {
        target: `http://127.0.0.1:${DFX_PORT}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
    },
  },
  define: {
    // Here we can define global constants
    // This is required for now because the code generated by dfx relies on process.env being set
    ...canisterDefinitions,
    "process.env.NODE_ENV": JSON.stringify(
      isDev ? "development" : "production",
    ),
  },
  build: {
    rollupOptions: {
      plugins: [inject({ Buffer: ['buffer', 'Buffer'] })],
    },
    minify: false
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [
        inlineImage(),
        NodeModulesPolyfillPlugin(),
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
      ],
    },
  },
  resolve: {
    alias: {
      process: "process/browser",
      stream: "stream-browserify",
      zlib: "browserify-zlib",
      util: "util",
    },
  },
})

// if --component flag is passed, we are building a component
if (process.env.COMPONENT) {
  config.build = {
    rollupOptions: {
      plugins: [tailwindcss(), inject({ Buffer: ['buffer', 'Buffer'] })],
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },
      },
    },
    assetsInlineLimit: 10000000,
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/App.jsx'),
      name: 'Trade',
      formats: ['es'],
      fileName: () => `Trade.js`,
    }
  }
}

export default config;