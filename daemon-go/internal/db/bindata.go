// Code generated for package db by go-bindata DO NOT EDIT. (@generated)
// sources:
// schema/schema.sql
package db

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func bindataRead(data []byte, name string) ([]byte, error) {
	gz, err := gzip.NewReader(bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("Read %q: %v", name, err)
	}

	var buf bytes.Buffer
	_, err = io.Copy(&buf, gz)
	clErr := gz.Close()

	if err != nil {
		return nil, fmt.Errorf("Read %q: %v", name, err)
	}
	if clErr != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

type asset struct {
	bytes []byte
	info  os.FileInfo
}

type bindataFileInfo struct {
	name    string
	size    int64
	mode    os.FileMode
	modTime time.Time
}

// Name return file name
func (fi bindataFileInfo) Name() string {
	return fi.name
}

// Size return file size
func (fi bindataFileInfo) Size() int64 {
	return fi.size
}

// Mode return file mode
func (fi bindataFileInfo) Mode() os.FileMode {
	return fi.mode
}

// Mode return file modify time
func (fi bindataFileInfo) ModTime() time.Time {
	return fi.modTime
}

// IsDir return file whether a directory
func (fi bindataFileInfo) IsDir() bool {
	return fi.mode&os.ModeDir != 0
}

// Sys return file is sys mode
func (fi bindataFileInfo) Sys() interface{} {
	return nil
}

var _schemaSchemaSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x9c\x54\x5d\x8f\x9a\x40\x14\x7d\xf7\x57\xdc\x98\x34\x62\xb2\xd6\xf6\xb9\x4f\x14\xae\x5b\x52\x1c\x2c\x42\xd2\x7d\x9c\xc2\x28\x93\xc2\x8c\x9d\x99\x2e\xf5\xdf\x37\x30\x50\xeb\x07\x2b\xbb\x4f\xc6\x73\xcf\x3d\x1e\xcf\x3d\xb0\x58\x40\x4e\x59\x25\xc5\x62\x2f\x97\x5c\x18\xa6\x04\x2d\x97\xf9\x8f\xa5\xce\x0a\x56\xd1\xee\xe3\xbd\xfe\x55\x4e\x26\x5e\x8c\x6e\x82\x90\xb8\x9f\x43\x84\xa0\xa2\x7b\xa6\xc1\x99\x00\x00\xf0\x1c\x02\x92\xe0\x23\xc6\x40\xa2\x04\x48\x1a\x86\xb0\x89\x83\xb5\x1b\x3f\xc1\x57\x7c\x02\x37\x4d\xa2\x80\x78\x31\xae\x91\x24\x0f\xed\x8a\xa0\x15\x83\x04\xbf\x27\xa7\x8d\x94\x04\xdf\x52\xb4\x63\xae\xbd\x82\x65\x3f\xd9\x0d\x61\x1f\x57\x6e\x1a\x26\xf0\xa1\x67\x6e\x59\xc9\x32\x33\x82\x5a\xf3\xdc\x14\x57\x2c\x3b\x2b\x18\xdf\x17\x66\x60\xb8\x93\xaa\xa2\xe6\xdc\xee\x64\xfe\xe9\x22\x92\x4d\x49\x8f\x25\xd7\x66\x64\x2a\xa3\x72\x30\xc7\xc3\xc5\xd8\xe2\xd3\xf6\x56\xcf\xb4\x9c\xf6\xbf\x61\x71\x5d\xc8\xda\x15\xbc\xa2\x86\x4b\xa1\x87\x13\xf9\x68\xe9\xb4\xac\xe9\x51\x6f\x0d\x55\x26\x12\x2b\xae\xb4\x69\xef\x7a\x37\xc9\xa9\x54\x39\x53\xd3\xd6\x99\x45\xb2\xdf\x4a\x31\x61\xd7\x03\x91\xb3\x3f\x2f\x68\x5c\x47\xc7\xdb\x36\x05\xa2\x8f\xb0\x4f\xb0\x55\xf3\x07\xae\x72\xe8\xc8\x83\x04\xde\xf8\xf8\x4f\xf4\x36\xcb\xf0\x8a\x9d\x87\xb8\x8a\x62\x0c\x1e\x49\x5b\x5d\xa7\xf3\x30\x87\x18\x57\x18\x23\xf1\x70\xdb\x95\xdf\xe1\xf9\x1c\x22\x02\xe9\xc6\x6f\xfe\x89\xe7\x6e\x3d\xd7\xc7\x06\xf1\x31\xc4\x13\x72\x43\xf4\x64\xfd\x4c\xf7\x5f\x83\xc6\x4a\x5f\x27\xa9\xeb\xba\xf6\xa4\xd8\xf1\x7d\x97\x61\x66\xbf\xdc\xe9\x2e\x3d\x1c\xde\xb2\x95\x19\xfe\xcc\x2e\x7b\x7f\xf7\x2e\x76\x6d\x2d\x05\x37\x52\xdd\x6a\xf7\x19\x81\xbc\xfc\x84\xbc\x3a\xd7\x81\xf6\x7d\xe1\xda\x48\x75\x1c\xd5\xbc\x6a\xd8\x7a\xdb\xa6\x16\xef\xeb\xee\x68\xa3\x76\x0d\xec\xcc\xde\xe9\xd9\x03\xcc\x84\xac\x67\xf3\xf9\x9b\xaa\x76\xf7\xfa\xdd\xab\xb0\xcf\xd6\x19\xb6\xdb\x2c\xff\x0d\x00\x00\xff\xff\x63\x22\x07\x06\xfe\x05\x00\x00")

func schemaSchemaSqlBytes() ([]byte, error) {
	return bindataRead(
		_schemaSchemaSql,
		"schema/schema.sql",
	)
}

func schemaSchemaSql() (*asset, error) {
	bytes, err := schemaSchemaSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "schema/schema.sql", size: 1534, mode: os.FileMode(420), modTime: time.Unix(1756240265, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

// Asset loads and returns the asset for the given name.
// It returns an error if the asset could not be found or
// could not be loaded.
func Asset(name string) ([]byte, error) {
	cannonicalName := strings.Replace(name, "\\", "/", -1)
	if f, ok := _bindata[cannonicalName]; ok {
		a, err := f()
		if err != nil {
			return nil, fmt.Errorf("Asset %s can't read by error: %v", name, err)
		}
		return a.bytes, nil
	}
	return nil, fmt.Errorf("Asset %s not found", name)
}

// MustAsset is like Asset but panics when Asset would return an error.
// It simplifies safe initialization of global variables.
func MustAsset(name string) []byte {
	a, err := Asset(name)
	if err != nil {
		panic("asset: Asset(" + name + "): " + err.Error())
	}

	return a
}

// AssetInfo loads and returns the asset info for the given name.
// It returns an error if the asset could not be found or
// could not be loaded.
func AssetInfo(name string) (os.FileInfo, error) {
	cannonicalName := strings.Replace(name, "\\", "/", -1)
	if f, ok := _bindata[cannonicalName]; ok {
		a, err := f()
		if err != nil {
			return nil, fmt.Errorf("AssetInfo %s can't read by error: %v", name, err)
		}
		return a.info, nil
	}
	return nil, fmt.Errorf("AssetInfo %s not found", name)
}

// AssetNames returns the names of the assets.
func AssetNames() []string {
	names := make([]string, 0, len(_bindata))
	for name := range _bindata {
		names = append(names, name)
	}
	return names
}

// _bindata is a table, holding each asset generator, mapped to its name.
var _bindata = map[string]func() (*asset, error){
	"schema/schema.sql": schemaSchemaSql,
}

// AssetDir returns the file names below a certain
// directory embedded in the file by go-bindata.
// For example if you run go-bindata on data/... and data contains the
// following hierarchy:
//
//	data/
//	  foo.txt
//	  img/
//	    a.png
//	    b.png
//
// then AssetDir("data") would return []string{"foo.txt", "img"}
// AssetDir("data/img") would return []string{"a.png", "b.png"}
// AssetDir("foo.txt") and AssetDir("notexist") would return an error
// AssetDir("") will return []string{"data"}.
func AssetDir(name string) ([]string, error) {
	node := _bintree
	if len(name) != 0 {
		cannonicalName := strings.Replace(name, "\\", "/", -1)
		pathList := strings.Split(cannonicalName, "/")
		for _, p := range pathList {
			node = node.Children[p]
			if node == nil {
				return nil, fmt.Errorf("Asset %s not found", name)
			}
		}
	}
	if node.Func != nil {
		return nil, fmt.Errorf("Asset %s not found", name)
	}
	rv := make([]string, 0, len(node.Children))
	for childName := range node.Children {
		rv = append(rv, childName)
	}
	return rv, nil
}

type bintree struct {
	Func     func() (*asset, error)
	Children map[string]*bintree
}

var _bintree = &bintree{nil, map[string]*bintree{
	"schema": &bintree{nil, map[string]*bintree{
		"schema.sql": &bintree{schemaSchemaSql, map[string]*bintree{}},
	}},
}}

// RestoreAsset restores an asset under the given directory
func RestoreAsset(dir, name string) error {
	data, err := Asset(name)
	if err != nil {
		return err
	}
	info, err := AssetInfo(name)
	if err != nil {
		return err
	}
	err = os.MkdirAll(_filePath(dir, filepath.Dir(name)), os.FileMode(0755))
	if err != nil {
		return err
	}
	err = os.WriteFile(_filePath(dir, name), data, info.Mode())
	if err != nil {
		return err
	}
	err = os.Chtimes(_filePath(dir, name), info.ModTime(), info.ModTime())
	if err != nil {
		return err
	}
	return nil
}

// RestoreAssets restores an asset under the given directory recursively
func RestoreAssets(dir, name string) error {
	children, err := AssetDir(name)
	// File
	if err != nil {
		return RestoreAsset(dir, name)
	}
	// Dir
	for _, child := range children {
		err = RestoreAssets(dir, filepath.Join(name, child))
		if err != nil {
			return err
		}
	}
	return nil
}

func _filePath(dir, name string) string {
	cannonicalName := strings.Replace(name, "\\", "/", -1)
	return filepath.Join(append([]string{dir}, strings.Split(cannonicalName, "/")...)...)
}
