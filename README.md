# plugin-metadata-enrichment

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-metadata-enrichment.svg?label=@salesforce/plugin-metadata-enrichment)](https://www.npmjs.com/package/@salesforce/plugin-metadata-enrichment) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-metadata-enrichment.svg)](https://npmjs.org/package/@salesforce/plugin-metadata-enrichment) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

## Install

```bash
sf plugins install @salesforce/plugin-metadata-enrichment@x.y.z
```

## Issues

Please report any issues at https://github.com/forcedotcom/cli/issues

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-metadata-enrichment

# Install the dependencies and compile
yarn && yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev metadata enrich
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins link .
# To verify
sf plugins
```

## Commands

<!-- commands -->

- [`sf metadata enrich`](#sf-metadata-enrich)

## `sf metadata enrich`

Enrich metadata

```
USAGE
  $ sf metadata enrich -o <value> -m <value>... [--json] [--flags-dir <value>]

FLAGS
  -m, --metadata=<value>...  (required) (required) Metadata type and optional component name to enrich.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Enrich metadata for a Salesforce component.

  You must run this command from within a project.

  Generate and store descriptions in metadata that provide additional context to the component’s functionality and
  purpose.

  To deploy multiple metadata components, either set multiple --metadata flags or a single --metadata flag with multiple
  names separated by spaces. Enclose names that contain spaces in one set of double quotes. The same syntax applies to
  --source-dir.

  This is not saved in the org until you deploy the project.

  This plugin only supports enrichment for LightningComponentBundle metadata at the moment.

EXAMPLES
  Enrich metadata for a select LightningComponentBundle in the project
  $ sf metadata enrich --metadata LightningComponentBundle:ComponentName

  Enrich metadata for a select LightningComponentBundle in the project for a specified target org
  $ sf metadata enrich --metadata LightningComponentBundle:ComponentName --target-org OrgAlias

  Enrich metadata for multiple LightningComponentBundle in the project
  $ sf metadata enrich --metadata LightningComponentBundle:Component1 --metadata LightningComponentBundle:Component2

  Enrich metadata for multiple LightningComponentBundle in the project matching wildcard
  $ sf metadata enrich --metadata LightningComponentBundle:Component*

FLAG DESCRIPTIONS
  -m, --metadata=<value>...  (required) Metadata type and optional component name to enrich.

    Wildcards (* ) supported as long as you use quotes, such as "LightningComponentBundle:MyClass*"
```

_See code: [src/commands/metadata/enrich.ts](https://github.com/salesforcecli/plugin-metadata-enrichment/blob/1.1.76/src/commands/metadata/enrich.ts)_

<!-- commandsstop -->
