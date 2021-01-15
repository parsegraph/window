uniform mat3 u_world;

attribute vec2 a_position;
attribute vec2 a_texCoord;

varying highp vec2 texCoord;

void main() {
	gl_Position = vec4((u_world * vec3(a_position, 1.0)).xy, 0.0, 1.0);
	texCoord = a_texCoord;
}

