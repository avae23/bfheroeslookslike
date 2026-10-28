# Prepare a Tripo hero GLB for the game: base colour texture to 1024 px JPEG, PBR maps dropped.
# Edits the GLB in place of a round trip through Blender, which moved the skeleton off the ground.
# Usage: pip install pillow && python3 tools/shrink-model.py in.glb src/models/<hero>.glb
import io, json, struct, sys
from PIL import Image

SIZE = 1024
src, dst = sys.argv[-2], sys.argv[-1]
data = open(src, 'rb').read()
json_len = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + json_len])
bin_start = 20 + json_len + 8
binary = data[bin_start:bin_start + struct.unpack_from('<I', data, 20 + json_len)[0]]

# The toon material only uses the base colour
for mat in gltf.get('materials', []):
    mat.get('pbrMetallicRoughness', {}).pop('metallicRoughnessTexture', None)
    for key in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
        mat.pop(key, None)
used = {mat['pbrMetallicRoughness']['baseColorTexture']['index']
        for mat in gltf.get('materials', []) if 'baseColorTexture' in mat.get('pbrMetallicRoughness', {})}
used_images = {gltf['textures'][t]['source'] for t in used}

views = [binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in gltf['bufferViews']]
for i, img in enumerate(gltf.get('images', [])):
    view = img['bufferView']
    pic = Image.open(io.BytesIO(views[view])).convert('RGB')
    if i in used_images:
        pic.thumbnail((SIZE, SIZE), Image.LANCZOS)
    else:
        pic = pic.resize((1, 1))
    out = io.BytesIO()
    pic.save(out, 'JPEG', quality=85)
    views[view] = out.getvalue()
    img['mimeType'] = 'image/jpeg'

packed = bytearray()
for view, chunk in zip(gltf['bufferViews'], views):
    packed += b'\0' * (-len(packed) % 4)
    view['byteOffset'] = len(packed)
    view['byteLength'] = len(chunk)
    packed += chunk
packed += b'\0' * (-len(packed) % 4)
gltf['buffers'][0]['byteLength'] = len(packed)

text = json.dumps(gltf, separators=(',', ':')).encode()
text += b' ' * (-len(text) % 4)
with open(dst, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(text) + 8 + len(packed)))
    f.write(struct.pack('<I4s', len(text), b'JSON') + text)
    f.write(struct.pack('<I4s', len(packed), b'BIN\0') + packed)
