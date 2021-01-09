export function addUniforms(material, uniforms) {
  prepareOnBeforeCompile(material)

  material.uniforms = uniforms

  material.addBeforeCompileListener((shader) => {
    material.uniforms = {
      ...material.uniforms,
      ...shader.uniforms,
    }

    shader.uniforms = material.uniforms
  })

  constructOnBeforeCompile(material)
}

export function customizeVertexShader(material, hooks) {
  prepareOnBeforeCompile(material)

  material.addBeforeCompileListener((shader) => {
    shader.vertexShader = monkeyPatch(shader.vertexShader, hooks)
  })

  constructOnBeforeCompile(material)
}
export function customizeFragmentShader(material, hooks) {
  prepareOnBeforeCompile(material)

  material.addBeforeCompileListener((shader) => {
    shader.fragmentShader = monkeyPatch(shader.fragmentShader, hooks)
  })

  constructOnBeforeCompile(material)
}

function prepareOnBeforeCompile(material) {
  if (material.beforeCompileListeners) {
    return
  }

  material.beforeCompileListeners = []
  material.addBeforeCompileListener = (fn) => {
    material.beforeCompileListeners.push(fn)
  }
}

function constructOnBeforeCompile(material) {
  material.onBeforeCompile = (shader) => {
    material.beforeCompileListeners.forEach((fn) => fn(shader))
  }
}

export function monkeyPatch(
  shader,
  {
    defines = '',
    head = '',
    main = '',
    transformed,
    objectNormal,
    transformedNormal,
    diffuse,
    ...replaces
  }
) {
  let patchedShader = shader

  const replaceAll = (str, find, rep) => str.split(find).join(rep)
  Object.keys(replaces).forEach((key) => {
    patchedShader = replaceAll(patchedShader, key, replaces[key])
  })

  patchedShader = patchedShader.replace(
    'void main() {',
    `
    ${head}
    void main() {
      ${main}
    `
  )

  if (transformed && patchedShader.includes('#include <begin_vertex>')) {
    patchedShader = patchedShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      ${transformed}
      `
    )
  }

  if (objectNormal && patchedShader.includes('#include <beginnormal_vertex>')) {
    patchedShader = patchedShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      ${objectNormal}
      `
    )
  }

  if (transformedNormal && patchedShader.includes('#include <defaultnormal_vertex>')) {
    patchedShader = patchedShader.replace(
      '#include <defaultnormal_vertex>',
      `#include <defaultnormal_vertex>
      ${transformedNormal}
      `
    )
  }

  if (diffuse && patchedShader.includes('vec4 diffuseColor = vec4( diffuse, opacity );')) {
    patchedShader = patchedShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec3 diffuse_;
      ${replaceAll(diffuse, 'diffuse =', 'diffuse_ =')}
      vec4 diffuseColor = vec4(diffuse_, opacity);
      `
    )
  }

  const stringDefines = Object.keys(defines)
    .map((d) => `#define ${d} ${defines[d]}`)
    .join('\n')

  return `
    ${stringDefines}
    ${patchedShader}
  `
}
