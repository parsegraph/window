uniform sampler2D u_texture;
varying highp vec2 texCoord;

void main() {
	gl_FragColor = texture2D(u_texture, texCoord.st);
	// gl_FragColor = vec4(1.0, 1.0, 1.0, 0.5);
}
