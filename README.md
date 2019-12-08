
# InterShop RPC

## Format of `intershop-package.json`

*	decribes what to do with the files in the package
* outermost values must be a JSON object
* with one entry `intershop-package-version` that specifies the version of the format itself; must currently
  be `1.0.0`
* another entry `"targets": {...}` that describes how to treat the source files
* `targets` maps from filenames (relative to package root) to purposes
* purpose may be either one of
	* `"ignore"`—do nothing; used e.g. for source files that have to be transpiled. This is the default and
	  may be left out
	* `"app"`—intended for the InterShop host application; as far as InterShop is concerned, equivalent to
	  `"ignore"`
	* `"import"`—will be imported by the InterShop `plpython3u` subsystem
	* `"rebuild"`—to be executed when the DB is rebuilt from scratch with the `intershop rebuild` command
	* `"redo"`—to be executed when part of the DB is redone with the `intershop redo` command (pending
	  official implementation of this feature)
* or a list with a number of choices; currently only `["rebuild","redo"]` (in either order) is allowed
* `intershop-package.json` files that do not meet the above criteria will cause an error

Example:

```json
{
	"intershop-package-version": "1.0.0",
	"targets": {
		"ipc.sql":                          			["rebuild","redo"],
		"intershop-rpc-server-secondary.js":			"app",
		"intershop-rpc-server-secondary.coffee":	"ignore",
		"ipc.py":                               	"import"
	}
}
```



