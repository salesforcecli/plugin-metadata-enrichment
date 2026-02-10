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

Enrich metadata components in your DX project by adding AI-generated descriptions.

```
USAGE
  $ sf metadata enrich -o <value> -m <value>... [--json] [--flags-dir <value>]

FLAGS
  -m, --metadata=<value>...  (required) Metadata type and optional component name to enrich.
  -o, --target-org=<value>   (required) Username or alias of the target
                             org. Not required if the `target-org` configuration variable is already set.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Enrich metadata components in your DX project by adding AI-generated descriptions.

  Use this command to add AI-generated descriptions right in the metadata source files in your local DX project. These enriched
  descriptions succinctly outline the metadata component’s purpose and capabilities, which in turn provide context when vibe
  coding with an AI tool, such as Agentforce Vibes.

  This command updates only the local metadata source files in your DX project; it doesn't change the components in your org. If
  you want the AI-generated descriptions in your org, then you must explicitly deploy the updated metadata components to your org
  by using, for example, the "project deploy start" CLI command.

  To enrich multiple metadata components, specify multiple --metadata <name> flags. Enclose names that contain spaces in double
  quotes.

  Even though this command updates only local files in your DX project, you're still required to authorize and specify an org,
  which is how the command accesses a large language model (LLM).

  Currently, this command supports enriching only Lightning Web Components, represented by the LightningComponentBundle metadata
  type.

  Your org must be eligible for metadata enrichment. Your Salesforce admin can help with that.

EXAMPLES
  Enrich the "HelloWorld" LightningComponentBundle metadata component in the local DX project; use your default org:

    $ sf metadata enrich --metadata LightningComponentBundle:HelloWorld

  Enrich the "HelloWorld" LightningComponentBundle metadata component and use the org with alias "my-org":

    $ sf metadata enrich --metadata LightningComponentBundle:HelloWorld --target-org my-org

  Enrich metadata for multiple LightningComponentBundles using your default org:

    $ sf metadata enrich --metadata LightningComponentBundle:Component1 --metadata LightningComponentBundle:Component2

  Enrich metadata for multiple LightningComponentBundles using a matching wildcard:

    $ sf metadata enrich --metadata "LightningComponentBundle:Component\*"

FLAG DESCRIPTIONS
  -m, --metadata=<value>...  Metadata type and optional component name to enrich.

    Wildcards ("_") are supported as long as you use double quotes, such as "LightningComponentBundle:MyClass_".
```

_See code: [src/commands/metadata/enrich.ts](https://github.com/salesforcecli/plugin-metadata-enrichment/blob/1.1.76/src/commands/metadata/enrich.ts)_

<!-- commandsstop -->
