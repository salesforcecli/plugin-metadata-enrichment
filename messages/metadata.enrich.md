# summary

Enrich metadata components in your DX project by adding AI-generated descriptions.

# description

Use this command to add AI-generated descriptions right in the metadata source files in your local DX project. These enriched descriptions succinctly outline the metadata component’s purpose and capabilities, which in turn provide context when vibe coding with an AI tool, such as Agentforce Vibes.

This command updates only the local metadata source files in your DX project; it doesn't change the components in your org. If you want the AI-generated descriptions in your org, then you must explicitly deploy the updated metadata components to your org by using, for example, the "project deploy start" CLI command.

To enrich multiple metadata components, specify multiple --metadata <name> flags. Enclose names that contain spaces in double quotes.

Even though this command updates only local files in your DX project, you're still required to authorize and specify an org, which is how the command accesses a large language model (LLM).

Currently, this command supports enriching only Lightning Web Components, represented by the LightningComponentBundle metadata type.

Your org must be eligible for metadata enrichment. Your Salesforce admin can help with that.

# examples

- Enrich the "HelloWorld" LightningComponentBundle metadata component in the local DX project; use your default org:

  <%= config.bin %> <%= command.id %> --metadata LightningComponentBundle:HelloWorld

- Enrich the "HelloWorld" LightningComponentBundle metadata component and use the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --metadata LightningComponentBundle:HelloWorld --target-org my-org

- Enrich metadata for multiple LightningComponentBundles using your default org:

  <%= config.bin %> <%= command.id %> --metadata LightningComponentBundle:Component1 --metadata LightningComponentBundle:Component2

- Enrich metadata for multiple LightningComponentBundles using a matching wildcard:

  <%= config.bin %> <%= command.id %> --metadata "LightningComponentBundle:Component\*"

# flags.metadata.summary

Metadata type and optional component name to enrich.

# flags.metadata.description

Wildcards ("_") are supported as long as you use double quotes, such as "LightningComponentBundle:MyClass_".

# stage.setup

Setting up and retrieving project source components

# stage.executing

Executing metadata enrichment

# stage.updating.files

Updating metadata configuration with enriched results
