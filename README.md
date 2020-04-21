# InterShop RPC

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [To Do](#to-do)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

A NodeJS RPC server for [InterShop](https://github.com/loveencounterflow/intershop).

# To Do

* [ ] Documentation.
* [ ] transition from old implementation in InterShop:
	* [x] check code completeness
	* [x] remove prv
	* [ ] rewrite code that uses prev model
	* [ ] reflect on how to deal w/ `log()` functionality
	* [ ] cleanup code, esp. wrt. implicit meta-methods in `$do_rpc()`
	* [ ] rename/rewrite methods to adapt to XEmitter API conventions, i.e. use `listen_to()`, `contract()`
	  and `emit()`, `delegate()` etc;
	* [ ] should provide a (partial) implementation of [Datom](https://github.com/loveencounterflow/datom)
	  (ex. a SQL method `new_datom()` should look similar to `datom.new_datom()`, result in JsonB)
	* [ ] equivalent to Datom's `select()` should use Postgres 12's new JSON Path functionality



