/**
 * @author alteredq / http://alteredqualia.com/
 * @author mrdoob / http://mrdoob.com/
 */

import { FrontSide, BackSide, DoubleSide, RGBAFormat, NearestFilter, PCFShadowMap, RGBADepthPacking, NoBlending } from '../../constants.js';
import { WebGLRenderTarget } from '../WebGLRenderTarget.js';
import { MeshDepthMaterial } from '../../materials/MeshDepthMaterial.js';
import { MeshDistanceMaterial } from '../../materials/MeshDistanceMaterial.js';
import { Vector4 } from '../../math/Vector4.js';
import { Vector2 } from '../../math/Vector2.js';
import { Frustum } from '../../math/Frustum.js';

function WebGLShadowMap( _renderer, _objects, maxTextureSize ) {

	var _frustum = new Frustum(),

		_shadowMapSize = new Vector2(),
		_viewportSize = new Vector2(),

		_viewport = new Vector4(),

		_MorphingFlag = 1,
		_SkinningFlag = 2,

		_NumberOfMaterialVariants = ( _MorphingFlag | _SkinningFlag ) + 1,

		_depthMaterials = new Array( _NumberOfMaterialVariants ),
		_distanceMaterials = new Array( _NumberOfMaterialVariants ),

		_materialCache = {};

	var shadowSide = { 0: BackSide, 1: FrontSide, 2: DoubleSide };

	// init

	for ( var i = 0; i !== _NumberOfMaterialVariants; ++ i ) {

		var useMorphing = ( i & _MorphingFlag ) !== 0;
		var useSkinning = ( i & _SkinningFlag ) !== 0;

		var depthMaterial = new MeshDepthMaterial( {

			depthPacking: RGBADepthPacking,

			morphTargets: useMorphing,
			skinning: useSkinning

		} );

		_depthMaterials[ i ] = depthMaterial;

		var distanceMaterial = new MeshDistanceMaterial( {

			morphTargets: useMorphing,
			skinning: useSkinning

		} );

		_distanceMaterials[ i ] = distanceMaterial;

	}

	var scope = this;

	this.enabled = false;

	this.autoUpdate = true;
	this.needsUpdate = false;

	this.type = PCFShadowMap;

	this.render = function ( lights, scene, camera ) {

		if ( scope.enabled === false ) return;
		if ( scope.autoUpdate === false && scope.needsUpdate === false ) return;

		if ( lights.length === 0 ) return;

		var currentRenderTarget = _renderer.getRenderTarget();
		var activeCubeFace = _renderer.getActiveCubeFace();
		var activeMipmapLevel = _renderer.getActiveMipmapLevel();

		var _state = _renderer.state;

		// Set GL state for depth map.
		_state.setBlending( NoBlending );
		_state.buffers.color.setClear( 1, 1, 1, 1 );
		_state.buffers.depth.setTest( true );
		_state.setScissorTest( false );

		// render depth map

		for ( var i = 0, il = lights.length; i < il; i ++ ) {

			var light = lights[ i ];
			var shadow = light.shadow;

			if ( shadow === undefined ) {

				console.warn( 'THREE.WebGLShadowMap:', light, 'has no shadow.' );
				continue;

			}

			_shadowMapSize.copy( shadow.mapSize );

			var shadowFrameExtents = shadow.getFrameExtents();

			_shadowMapSize.multiply( shadowFrameExtents );

			_viewportSize.copy( shadow.mapSize );

			if ( _shadowMapSize.x > maxTextureSize || _shadowMapSize.y > maxTextureSize ) {

				console.warn( 'THREE.WebGLShadowMap:', light, 'has shadow exceeding max texture size, reducing' );

				if ( _shadowMapSize.x > maxTextureSize ) {

					_viewportSize.x = Math.floor( maxTextureSize / shadowFrameExtents.x );
					_shadowMapSize.x = _viewportSize.x * shadowFrameExtents.x;
					shadow.mapSize.x = _viewportSize.x;

				}

				if ( _shadowMapSize.y > maxTextureSize ) {

					_viewportSize.y = Math.floor( maxTextureSize / shadowFrameExtents.y );
					_shadowMapSize.y = _viewportSize.y * shadowFrameExtents.y;
					shadow.mapSize.y = _viewportSize.y;

				}

			}

			if ( shadow.map === null ) {

				var pars = { minFilter: NearestFilter, magFilter: NearestFilter, format: RGBAFormat };

				shadow.map = new WebGLRenderTarget( _shadowMapSize.x, _shadowMapSize.y, pars );
				shadow.map.texture.name = light.name + ".shadowMap";

			}

			_renderer.setRenderTarget( shadow.map );
			_renderer.clear();

			var viewportCount = shadow.getViewportCount();

			for ( var vp = 0; vp < viewportCount; vp ++ ) {

				var viewport = shadow.getViewport( vp );

				_viewport.set(
					_viewportSize.x * viewport.x,
					_viewportSize.y * viewport.y,
					_viewportSize.x * viewport.z,
					_viewportSize.y * viewport.w
				);

				_state.viewport( _viewport );

				shadow.updateMatrices( light, camera, vp );

				_frustum = shadow.getFrustum();

				renderObject( scene, camera, shadow.camera, light );

			}

		}

		scope.needsUpdate = false;

		_renderer.setRenderTarget( currentRenderTarget, activeCubeFace, activeMipmapLevel );

	};

	function getDepthMaterial( object, material, light, shadowCameraNear, shadowCameraFar ) {

		var geometry = object.geometry;

		var result = null;

		var materialVariants = _depthMaterials;
		var customMaterial = object.customDepthMaterial;

		if ( light.isPointLight ) {

			materialVariants = _distanceMaterials;
			customMaterial = object.customDistanceMaterial;

		}

		if ( ! customMaterial ) {

			var useMorphing = false;

			if ( material.morphTargets ) {

				if ( geometry && geometry.isBufferGeometry ) {

					useMorphing = geometry.morphAttributes && geometry.morphAttributes.position && geometry.morphAttributes.position.length > 0;

				} else if ( geometry && geometry.isGeometry ) {

					useMorphing = geometry.morphTargets && geometry.morphTargets.length > 0;

				}

			}

			if ( object.isSkinnedMesh && material.skinning === false ) {

				console.warn( 'THREE.WebGLShadowMap: THREE.SkinnedMesh with material.skinning set to false:', object );

			}

			var useSkinning = object.isSkinnedMesh && material.skinning;

			var variantIndex = 0;

			if ( useMorphing ) variantIndex |= _MorphingFlag;
			if ( useSkinning ) variantIndex |= _SkinningFlag;

			result = materialVariants[ variantIndex ];

		} else {

			result = customMaterial;

		}

		if ( _renderer.localClippingEnabled &&
				material.clipShadows === true &&
				material.clippingPlanes.length !== 0 ) {

			// in this case we need a unique material instance reflecting the
			// appropriate state

			var keyA = result.uuid, keyB = material.uuid;

			var materialsForVariant = _materialCache[ keyA ];

			if ( materialsForVariant === undefined ) {

				materialsForVariant = {};
				_materialCache[ keyA ] = materialsForVariant;

			}

			var cachedMaterial = materialsForVariant[ keyB ];

			if ( cachedMaterial === undefined ) {

				cachedMaterial = result.clone();
				materialsForVariant[ keyB ] = cachedMaterial;

			}

			result = cachedMaterial;

		}

		result.visible = material.visible;
		result.wireframe = material.wireframe;

		result.side = ( material.shadowSide != null ) ? material.shadowSide : shadowSide[ material.side ];

		result.clipShadows = material.clipShadows;
		result.clippingPlanes = material.clippingPlanes;
		result.clipIntersection = material.clipIntersection;

		result.wireframeLinewidth = material.wireframeLinewidth;
		result.linewidth = material.linewidth;

		if ( light.isPointLight && result.isMeshDistanceMaterial ) {

			result.referencePosition.setFromMatrixPosition( light.matrixWorld );
			result.nearDistance = shadowCameraNear;
			result.farDistance = shadowCameraFar;

		}

		return result;

	}

	function renderObject( object, camera, shadowCamera, light ) {

		if ( object.visible === false ) return;

		var visible = object.layers.test( camera.layers );

		if ( visible && ( object.isMesh || object.isLine || object.isPoints ) ) {

			if ( object.castShadow && ( ! object.frustumCulled || _frustum.intersectsObject( object ) ) ) {

				object.modelViewMatrix.multiplyMatrices( shadowCamera.matrixWorldInverse, object.matrixWorld );

				var geometry = _objects.update( object );
				var material = object.material;

				if ( Array.isArray( material ) ) {

					var groups = geometry.groups;

					for ( var k = 0, kl = groups.length; k < kl; k ++ ) {

						var group = groups[ k ];
						var groupMaterial = material[ group.materialIndex ];

						if ( groupMaterial && groupMaterial.visible ) {

							var depthMaterial = getDepthMaterial( object, groupMaterial, light, shadowCamera.near, shadowCamera.far );
							_renderer.renderBufferDirect( shadowCamera, null, geometry, depthMaterial, object, group );

						}

					}

				} else if ( material.visible ) {

					var depthMaterial = getDepthMaterial( object, material, light, shadowCamera.near, shadowCamera.far );
					_renderer.renderBufferDirect( shadowCamera, null, geometry, depthMaterial, object, null );

				}

			}

		}

		var children = object.children;

		for ( var i = 0, l = children.length; i < l; i ++ ) {

			renderObject( children[ i ], camera, shadowCamera, light );

		}

	}

}


export { WebGLShadowMap };
