import { Matrix4 } from '../math/Matrix4.js';
import { Vector2 } from '../math/Vector2.js';
import { Vector3 } from '../math/Vector3.js';
import { Vector4 } from '../math/Vector4.js';
import { Frustum } from '../math/Frustum.js';

/**
 * @author mrdoob / http://mrdoob.com/
 */

function LightShadow( camera ) {

	this.camera = camera;

	this.bias = 0;
	this.radius = 1;

	this.mapSize = new Vector2( 512, 512 );

	this.map = null;
	this.matrix = new Matrix4();

	this._frustum = new Frustum();
	this._frameExtents = new Vector2( 1, 1 );

	this._viewportCount = 1;

	this._viewports = [

		new Vector4( 0, 0, 1, 1 )

	];

}

Object.assign( LightShadow.prototype, {

	_projScreenMatrix: new Matrix4(),

	_lightPositionWorld: new Vector3(),

	_lookTarget: new Vector3(),

	getViewportCount: function () {

		return this._viewportCount;

	},

	getFrustum: function () {

		return this._frustum;

	},

	updateMatrices: function () {

		var shadowCamera = this.camera,
			shadowMatrix = this.matrix,
			projScreenMatrix = this._projScreenMatrix;

		projScreenMatrix.multiplyMatrices( shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse );
		this._frustum.setFromMatrix( projScreenMatrix );

		shadowMatrix.set(
			0.5, 0.0, 0.0, 0.5,
			0.0, 0.5, 0.0, 0.5,
			0.0, 0.0, 0.5, 0.5,
			0.0, 0.0, 0.0, 1.0
		);

		shadowMatrix.multiply( shadowCamera.projectionMatrix );
		shadowMatrix.multiply( shadowCamera.matrixWorldInverse );

	},

	getViewport: function ( viewportIndex ) {

		return this._viewports[ viewportIndex ];

	},

	getFrameExtents: function () {

		return this._frameExtents;

	},

	copy: function ( source ) {

		this.camera = source.camera.clone();

		this.bias = source.bias;
		this.radius = source.radius;

		this.mapSize.copy( source.mapSize );

		return this;

	},

	clone: function () {

		return new this.constructor().copy( this );

	},

	toJSON: function () {

		var object = {};

		if ( this.bias !== 0 ) object.bias = this.bias;
		if ( this.radius !== 1 ) object.radius = this.radius;
		if ( this.mapSize.x !== 512 || this.mapSize.y !== 512 ) object.mapSize = this.mapSize.toArray();

		object.camera = this.camera.toJSON( false ).object;
		delete object.camera.matrix;

		return object;

	}

} );


export { LightShadow };
