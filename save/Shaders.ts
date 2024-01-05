
import * as THREE from "three";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 60, window.innerWidth/window.innerHeight, 0.1, 1000 );
const canvas = document.createElement( "canvas" );
const context = canvas.getContext( "webgl2" );
if(!context) throw Error("No webgl2");
const renderer = new THREE.WebGLRenderer({canvas, context});

let vpSize = [window.innerWidth, window.innerHeight];
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.append(renderer.domElement);

const geometry = new THREE.BoxGeometry( 2, 2, 2 );

const uniforms = {
    u_resolution: {type: "v2", value: {x: vpSize[0], y: vpSize[1]}},
    u_dashSize : {type:"f", value: 10.0},
    u_gapSize : {type:"f", value: 5.0},
    u_color : {type: "v3", value: {x:0.0, y:0.0, z:0.0}}
};

const vertexShader = `
flat out vec3 startPos;
out vec3 vertPos;

void main() {
    vec4 pos    = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = pos;
    vertPos     = pos.xyz / pos.w;
    startPos    = vertPos;
}`;
const fragmentShader = `
precision highp float;

flat in vec3 startPos;
in vec3 vertPos;

uniform vec3  u_color;
uniform vec2  u_resolution;
uniform float u_dashSize;
uniform float u_gapSize;

void main(){

    vec2  dir  = (vertPos.xy-startPos.xy) * u_resolution.xy/2.0;
    float dist = length(dir);

    if (fract(dist / (u_dashSize + u_gapSize)) > u_dashSize/(u_dashSize + u_gapSize))
        discard;
    gl_FragColor = vec4(u_color.rgb, 1.0);
}`;

const material = new THREE.ShaderMaterial({
	uniforms,
	vertexShader,
	fragmentShader
});

const LINES_DASHED = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    material);

LINES_DASHED.computeLineDistances();

scene.add( LINES_DASHED );


scene.background = new THREE.Color( 0xFFFFFF);
camera.position.z = 5;

const animate = (): void => {
    requestAnimationFrame( animate );
    LINES_DASHED.rotation.x += 0.01;
    LINES_DASHED.rotation.y += 0.01;
    renderer.render( scene, camera );
};

window.onresize = function() {
    vpSize = [window.innerWidth, window.innerHeight];
    LINES_DASHED.material.uniforms.u_resolution.value.x = window.innerWidth;
    LINES_DASHED.material.uniforms.u_resolution.value.y = window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
};

animate();
