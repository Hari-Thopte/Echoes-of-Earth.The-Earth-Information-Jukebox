// GLSL Shaders for Earth, Cryosphere Ice Overlay, Clouds, Atmosphere & Post-Processing
const EJ_SHADERS = {
  earthVert: `
    varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPosition = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,

  earthFrag: `
    uniform sampler2D uDayTexture; uniform sampler2D uNormalMap; uniform sampler2D uNightTexture;
    uniform sampler2D uSpecularMap; uniform sampler2D uCloudsTexture; uniform vec3 uSunDirection;
    uniform float uTerminatorSoftness; uniform float uSunIntensity; uniform float uAmbientLight;
    uniform float uNightLightsIntensity; uniform float uBumpScale; uniform float uOceanShininess;
    uniform float uCloudShadowStrength; uniform float uCloudMaskChannel;
    varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPosition;

    vec3 perturbNormal(vec3 N, vec2 texcoord) {
      vec3 mapN = texture2D(uNormalMap, texcoord).xyz * 2.0 - 1.0;
      mapN.xy *= uBumpScale;
      vec3 q0 = dFdx(vWorldPosition), q1 = dFdy(vWorldPosition);
      vec2 st0 = dFdx(texcoord), st1 = dFdy(texcoord);
      vec3 S = normalize(q0 * st1.t - q1 * st0.t);
      vec3 T = normalize(-q0 * st1.s + q1 * st0.s);
      return normalize(mat3(S, T, N) * mapN);
    }

    void main() {
      vec3 geomNormal = normalize(vWorldNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 sunDir = normalize(uSunDirection);
      vec3 normal = perturbNormal(geomNormal, vUv);
      float sunDot = dot(normal, sunDir);
      float dayFactor = smoothstep(-uTerminatorSoftness, uTerminatorSoftness, sunDot);
      float nightFactor = smoothstep(uTerminatorSoftness * 0.5, -uTerminatorSoftness, sunDot);
      vec3 dayTex = texture2D(uDayTexture, vUv).rgb;
      vec4 cloudTexel = texture2D(uCloudsTexture, vUv - sunDir.xy * 0.0035);
      float cloudCoverage = mix(cloudTexel.a, cloudTexel.r, uCloudMaskChannel);
      float cloudShadow = 1.0 - (cloudCoverage * uCloudShadowStrength * dayFactor);
      vec3 litDayColor = dayTex * (max(0.0, sunDot) * uSunIntensity * cloudShadow + uAmbientLight);
      vec3 litNightColor = texture2D(uNightTexture, vUv).rgb * uNightLightsIntensity * nightFactor;
      vec3 halfVec = normalize(sunDir + viewDir);
      float specIntensity = pow(max(0.0, dot(normal, halfVec)), uOceanShininess);
      float oceanMask = texture2D(uSpecularMap, vUv).r;
      float oceanFresnel = 0.04 + 0.96 * pow(1.0 - max(0.0, dot(normal, viewDir)), 5.0);
      vec3 oceanSpecular = vec3(0.95, 0.98, 1.0) * specIntensity * oceanMask * oceanFresnel * dayFactor * uSunIntensity * 0.85;
      float limbFresnel = pow(1.0 - max(0.0, dot(geomNormal, viewDir)), 3.6);
      vec3 limbHaze = vec3(0.32, 0.62, 1.0) * limbFresnel * max(0.0, dot(geomNormal, sunDir) + 0.25) * 0.32;
      gl_FragColor = vec4(mix(litNightColor, litDayColor, dayFactor) + oceanSpecular + limbHaze, 1.0);
    }
  `,

  overlayVert: `
    uniform sampler2D uOverlayTexA;
    uniform sampler2D uOverlayTexB;
    uniform float uCrossfade;
    uniform float uHeightExtrusion;
    uniform float uDomainMode;

    varying vec2 vUv;
    varying vec3 vLocalPos;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;

    void main() {
      vUv = uv;
      vLocalPos = normalize(position);
      float cA = texture2D(uOverlayTexA, uv).a;
      float cB = texture2D(uOverlayTexB, uv).a;
      float conc = mix(cA, cB, uCrossfade);

      bool isCryosphere = (uDomainMode < 0.5 || uDomainMode >= 4.5);
      float polarMask = isCryosphere
        ? (uDomainMode < 0.5 ? smoothstep(0.79, 0.89, vLocalPos.y) : smoothstep(-0.76, -0.88, vLocalPos.y))
        : 1.0;
      float liftScale = isCryosphere ? 1.0 : 0.35;
      float thicknessLift = pow(max(0.0, conc - 0.14) / 0.86, 1.3) * uHeightExtrusion * polarMask * liftScale;
      vec3 displacedPos = position + normal * thicknessLift;

      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 wp = modelMatrix * vec4(displacedPos, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,

  overlayFrag: `
    uniform sampler2D uOverlayTexA;
    uniform sampler2D uOverlayTexB;
    uniform sampler2D uBaseline2003Tex;
    uniform sampler2D uSpecularMap;
    uniform float uCrossfade;
    uniform float uOverlayOpacity;
    uniform float uRippleBoost;
    uniform float uEdgeGlowStrength;
    uniform float uStyleMode;
    uniform float uDomainMode;
    uniform float uTime;
    uniform float uSplitCurtainActive;
    uniform float uSplitScreenX;
    uniform vec2 uResolution;
    uniform vec3 uSunDirection;

    varying vec2 vUv;
    varying vec3 vLocalPos;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;

    float hash3(vec3 p) {
      p = fract(p * vec3(443.897, 441.423, 437.195));
      p += dot(p, p.yzx + 19.19);
      return fract((p.x + p.y) * p.z);
    }

    float noise3D(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
            mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
            mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
        f.z
      );
    }

    // Dual-layer Parallax Ridged Sea-Ice Floe Network
    float evaluateCryosphereFloes(vec3 p, vec3 viewDir, out float pressureRidge, out float subsurfaceParallax) {
      float n1 = noise3D(p * 32.0);
      float n2 = noise3D(p * 78.0);
      float n3 = noise3D(p * 175.0);
      float r1 = 1.0 - abs(n1 * 2.0 - 1.0);
      float r2 = 1.0 - abs(n2 * 2.0 - 1.0);
      pressureRidge = pow(r1 * 0.62 + r2 * 0.38, 2.5);

      // Subsurface parallax layer offset along view ray
      vec3 subPos = p - viewDir * 0.012;
      subsurfaceParallax = 1.0 - abs(noise3D(subPos * 46.0) * 2.0 - 1.0);
      return clamp(r1 * 0.54 + r2 * 0.31 + n3 * 0.15, 0.0, 1.0);
    }

    vec3 scientificThermalRamp(float c) {
      vec3 c0 = vec3(0.05, 0.22, 0.54);
      vec3 c1 = vec3(0.04, 0.66, 0.86);
      vec3 c2 = vec3(0.28, 0.90, 0.60);
      vec3 c3 = vec3(0.98, 0.86, 0.22);
      vec3 c4 = vec3(1.00, 0.98, 1.00);
      if (c < 0.35) return mix(c0, c1, (c - 0.15) / 0.20);
      if (c < 0.60) return mix(c1, c2, (c - 0.35) / 0.25);
      if (c < 0.82) return mix(c2, c3, (c - 0.60) / 0.22);
      return mix(c3, c4, clamp((c - 0.82) / 0.18, 0.0, 1.0));
    }

    void main() {
      bool isCryosphere = (uDomainMode < 0.5 || uDomainMode >= 4.5);
      if (uDomainMode < 0.5 && vLocalPos.y < 0.795) discard;
      if (uDomainMode >= 4.5 && vLocalPos.y > -0.730) discard;

      vec4 sampleA = texture2D(uOverlayTexA, vUv);
      vec4 sampleB = texture2D(uOverlayTexB, vUv);
      vec4 curSample = mix(sampleA, sampleB, uCrossfade);

      float screenNormX = gl_FragCoord.x / max(1.0, uResolution.x);
      if (uSplitCurtainActive > 0.5 && screenNormX < uSplitScreenX) {
        curSample = texture2D(uBaseline2003Tex, vUv);
      }

      float conc = curSample.a;
      if (isCryosphere && conc < 0.14) discard;
      if (!isCryosphere && conc < 0.05) discard;

      float oceanVal = texture2D(uSpecularMap, vUv).r;
      vec3 V = normalize(cameraPosition - vWorldPos);
      vec3 L = normalize(uSunDirection);
      float sunDiffuse = clamp(dot(vWorldNormal, L) * 0.45 + 0.68, 0.45, 1.15);
      float viewFresnel = pow(1.0 - max(0.0, dot(vWorldNormal, V)), 3.2);

      // Mode 0 (Arctic) & Mode 5 (Antarctica): Subsurface Parallax Cryosphere
      if (isCryosphere) {
        float landMask = smoothstep(0.04, 0.22, oceanVal);
        if (uDomainMode < 0.5 && vLocalPos.y > 0.992) landMask = 1.0;
        if (landMask < 0.05) discard;

        float pressureRidge = 0.0;
        float subParallax = 0.0;
        float floe = evaluateCryosphereFloes(vLocalPos, V, pressureRidge, subParallax);

        vec2 texel = vec2(1.0 / 1024.0, 1.0 / 512.0);
        float cN = mix(texture2D(uOverlayTexA, vUv + vec2(0.0, texel.y)).a, texture2D(uOverlayTexB, vUv + vec2(0.0, texel.y)).a, uCrossfade);
        float cS = mix(texture2D(uOverlayTexA, vUv - vec2(0.0, texel.y)).a, texture2D(uOverlayTexB, vUv - vec2(0.0, texel.y)).a, uCrossfade);
        float cE = mix(texture2D(uOverlayTexA, vUv + vec2(texel.x, 0.0)).a, texture2D(uOverlayTexB, vUv + vec2(texel.x, 0.0)).a, uCrossfade);
        float cW = mix(texture2D(uOverlayTexA, vUv - vec2(texel.x, 0.0)).a, texture2D(uOverlayTexB, vUv - vec2(texel.x, 0.0)).a, uCrossfade);
        vec2 gradVec = vec2(cE - cW, cN - cS);
        float edgeRim = smoothstep(0.025, 0.22, length(gradVec)) * uEdgeGlowStrength;

        vec3 slopePerturb = normalize(vec3(-gradVec.x * 3.6, -gradVec.y * 3.6, 1.0));
        vec3 N = normalize(vWorldNormal + slopePerturb * 0.25 + (floe - 0.5) * 0.2);

        float iceSunDiff = clamp(dot(N, L) * 0.5 + 0.62, 0.44, 1.15);
        vec3 H = normalize(L + V);
        float iceSpec = pow(max(0.0, dot(N, H)), 56.0) * (0.3 + pressureRidge * 0.5) * conc;
        float normC = clamp((conc - 0.15) / 0.85, 0.0, 1.0);

        vec3 cryosphereCol = mix(vec3(0.10, 0.42, 0.72), vec3(0.54, 0.82, 0.96), smoothstep(0.0, 0.48, normC));
        cryosphereCol = mix(cryosphereCol, vec3(0.95, 0.98, 1.00), smoothstep(0.42, 0.90, normC));
        cryosphereCol += vec3(0.08, 0.28, 0.45) * subParallax * (1.0 - normC * 0.5) * 0.35;
        cryosphereCol += vec3(pressureRidge * 0.18 * normC);
        float floeSolid = smoothstep(0.18, 0.66, floe + normC * 0.5);
        cryosphereCol = mix(vec3(0.02, 0.08, 0.20), cryosphereCol, floeSolid);

        vec3 baseIceCol = mix(cryosphereCol, scientificThermalRamp(conc), uStyleMode);
        vec3 rimLight = vec3(0.28, 0.84, 1.0) * (edgeRim * 0.55 + viewFresnel * 0.18);
        vec3 litIce = baseIceCol * iceSunDiff * (1.0 + uRippleBoost) + vec3(iceSpec) + rimLight;
        float marginalFeather = smoothstep(0.14, 0.26, conc * (0.86 + floe * 0.22));
        float finalAlpha = clamp(marginalFeather * (0.64 + 0.36 * normC) * landMask * uOverlayOpacity + edgeRim * 0.22, 0.0, 0.96);
        gl_FragColor = vec4(litIce, finalAlpha);
        return;
      }

      // Mode 1: Air Quality / Aerosols (Drifting atmospheric dust & smoke plumes)
      if (uDomainMode < 1.5) {
        float plumeNoise = noise3D(vLocalPos * 14.0 + vec3(uTime * 0.06, 0.0, uTime * 0.03));
        float fineDust = noise3D(vLocalPos * 38.0 - vec3(uTime * 0.09, uTime * 0.02, 0.0));
        float density = clamp(conc * (0.78 + 0.38 * plumeNoise + 0.15 * fineDust), 0.0, 1.0);
        vec3 airCol = mix(vec3(0.14, 0.65, 0.88), vec3(0.98, 0.75, 0.14), smoothstep(0.18, 0.52, density));
        airCol = mix(airCol, vec3(0.94, 0.27, 0.20), smoothstep(0.52, 0.92, density));
        airCol = mix(airCol, scientificThermalRamp(density), uStyleMode);
        vec3 litAir = airCol * sunDiffuse * (1.0 + uRippleBoost) + vec3(0.98, 0.65, 0.25) * viewFresnel * 0.22;
        float alpha = smoothstep(0.12, 0.85, density) * 0.76 * uOverlayOpacity;
        gl_FragColor = vec4(litAir, alpha);
        return;
      }

      // Mode 2: Vegetation Greenness / NDVI (Clipped cleanly to continental landmasses)
      if (uDomainMode < 2.5) {
        float landMask = 1.0 - smoothstep(0.05, 0.26, oceanVal);
        if (vLocalPos.y > 0.96) landMask = 0.0;
        if (landMask < 0.05) discard;
        float canopyTex = noise3D(vLocalPos * 42.0);
        float ndvi = clamp(conc * (0.88 + canopyTex * 0.24), 0.0, 1.0);
        vec3 vegCol = mix(vec3(0.68, 0.50, 0.20), vec3(0.42, 0.78, 0.20), smoothstep(0.10, 0.45, ndvi));
        vegCol = mix(vegCol, vec3(0.06, 0.72, 0.46), smoothstep(0.45, 0.88, ndvi));
        vegCol = mix(vegCol, scientificThermalRamp(ndvi), uStyleMode);
        vec3 litVeg = vegCol * sunDiffuse * (1.0 + uRippleBoost);
        float alpha = smoothstep(0.08, 0.28, conc) * landMask * 0.78 * uOverlayOpacity;
        gl_FragColor = vec4(litVeg, alpha);
        return;
      }

      // Mode 3: Global Surface Temperature Anomaly
      if (uDomainMode < 3.5) {
        float tNoise = noise3D(vLocalPos * 16.0);
        float tVal = clamp(conc * (0.94 + tNoise * 0.12), 0.0, 1.0);
        vec3 tempCol = mix(vec3(0.15, 0.44, 0.92), vec3(0.98, 0.75, 0.20), smoothstep(0.15, 0.52, tVal));
        tempCol = mix(tempCol, vec3(0.98, 0.30, 0.42), smoothstep(0.50, 0.82, tVal));
        tempCol = mix(tempCol, vec3(1.00, 0.85, 0.88), smoothstep(0.82, 1.0, tVal));
        tempCol = mix(tempCol, scientificThermalRamp(tVal), uStyleMode);
        vec3 litTemp = tempCol * sunDiffuse * (1.0 + uRippleBoost) + vec3(1.0, 0.45, 0.55) * viewFresnel * 0.16;
        float alpha = smoothstep(0.08, 0.75, conc) * 0.68 * uOverlayOpacity;
        gl_FragColor = vec4(litTemp, alpha);
        return;
      }

      // Mode 4: Global Rainfall & Monsoon Precipitation
      float stormSwirl = noise3D(vLocalPos * vec3(18.0, 32.0, 18.0) + vec3(uTime * 0.14, 0.0, -uTime * 0.08));
      float rainCells = noise3D(vLocalPos * 52.0 + vec3(uTime * 0.22, uTime * 0.05, 0.0));
      float rainRate = clamp(conc * (0.72 + stormSwirl * 0.38 + rainCells * 0.22), 0.0, 1.0);
      vec3 rainCol = mix(vec3(0.12, 0.28, 0.68), vec3(0.22, 0.74, 0.97), smoothstep(0.12, 0.48, rainRate));
      rainCol = mix(rainCol, vec3(0.75, 0.52, 0.99), smoothstep(0.48, 0.84, rainRate));
      rainCol = mix(rainCol, vec3(0.96, 0.94, 1.00), smoothstep(0.84, 1.0, rainRate));
      rainCol = mix(rainCol, scientificThermalRamp(rainRate), uStyleMode);
      vec3 litRain = rainCol * sunDiffuse * (1.0 + uRippleBoost) + vec3(0.45, 0.75, 1.0) * viewFresnel * 0.2;
      float alpha = smoothstep(0.10, 0.72, rainRate) * 0.82 * uOverlayOpacity;
      gl_FragColor = vec4(litRain, alpha);
    }
  `,

  cloudsVert: `
    varying vec2 vUv; varying vec3 vWorldNormal;
    void main() { vUv = uv; vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,

  cloudsFrag: `
    uniform sampler2D uCloudsTexture; uniform vec3 uSunDirection; uniform float uSunIntensity; uniform float uCloudOpacity; uniform float uCloudMaskChannel;
    varying vec2 vUv; varying vec3 vWorldNormal;
    void main() {
      vec3 normal = normalize(vWorldNormal);
      float sunDot = dot(normal, normalize(uSunDirection));
      float cloudDay = smoothstep(-0.25, 0.25, sunDot);
      vec4 cloudSample = texture2D(uCloudsTexture, vUv);
      float coverage = mix(cloudSample.a, cloudSample.r, uCloudMaskChannel);
      float cloudAlpha = coverage * uCloudOpacity;
      vec3 cloudColor = vec3(0.96, 0.98, 1.0) * (cloudDay * uSunIntensity + 0.05);
      gl_FragColor = vec4(cloudColor, cloudAlpha * (cloudDay * 0.85 + 0.15));
    }
  `,

  atmosphereVert: `
    varying vec3 vWorldNormal; varying vec3 vWorldPosition;
    void main() { vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vec4 wp = modelMatrix * vec4(position, 1.0); vWorldPosition = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
  `,

  atmosphereFrag: `
    uniform vec3 uAtmosphereColor; uniform float uAtmospherePower; uniform float uAtmosphereStrength; uniform float uTwilightWarmth; uniform vec3 uSunDirection;
    varying vec3 vWorldNormal; varying vec3 vWorldPosition;
    void main() {
      vec3 normal = normalize(vWorldNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 sunDir = normalize(uSunDirection);
      float fresnel = pow(1.0 - abs(dot(normal, viewDir)), uAtmospherePower);
      float sunDot = dot(normal, sunDir);
      float terminatorBand = exp(-pow(sunDot / 0.22, 2.0));
      vec3 atmosphereColor = mix(uAtmosphereColor, vec3(0.14, 0.58, 0.98), terminatorBand * uTwilightWarmth);
      float sunScatter = smoothstep(-0.35, 0.5, sunDot) * 0.88 + 0.12;
      gl_FragColor = vec4(atmosphereColor * fresnel * sunScatter * uAtmosphereStrength, fresnel);
    }
  `,

  brightVert: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,

  brightFrag: `
    uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      float f = clamp((luma - threshold) / max(0.001, 1.0 - threshold), 0.0, 1.0);
      gl_FragColor = vec4(c.rgb * f, 1.0);
    }
  `,

  blurVert: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,

  blurFrag: `
    uniform sampler2D tDiffuse; uniform vec2 direction; varying vec2 vUv;
    void main() {
      vec4 c = vec4(0.0);
      c += texture2D(tDiffuse, vUv - direction * 3.0) * 0.12;
      c += texture2D(tDiffuse, vUv - direction * 1.5) * 0.22;
      c += texture2D(tDiffuse, vUv) * 0.32;
      c += texture2D(tDiffuse, vUv + direction * 1.5) * 0.22;
      c += texture2D(tDiffuse, vUv + direction * 3.0) * 0.12;
      gl_FragColor = c;
    }
  `,

  compositeVert: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,

  compositeFrag: `
    uniform sampler2D tScene; uniform sampler2D tBloom; uniform float bloomStrength; uniform float grainIntensity; uniform float sceneFade; uniform float time;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec3 ACESFilmic(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec3 col = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomStrength;
      col = pow(ACESFilmic(col), vec3(1.0 / 2.2));
      float vig = smoothstep(0.92, 0.34, length(vUv - 0.5));
      col *= vig;
      col += (hash(vUv * 800.0 + fract(time * 23.41)) - 0.5) * grainIntensity;
      col *= sceneFade;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};
