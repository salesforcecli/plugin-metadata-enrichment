# summary

Enrich metadata for a Salesforce component.

# description

You must run this command from within a project.

Generate and store descriptions in metadata that provide additional context to the component’s functionality and purpose.

To deploy multiple metadata components, either set multiple --metadata flags or a single --metadata flag with multiple names separated by spaces. Enclose names that contain spaces in one set of double quotes. The same syntax applies to --source-dir.

This is not saved in the org until you deploy the project.

This plugin only supports enrichment for LightningComponentBundle metadata at the moment.

# examples

- Enrich metadata for a select LightningComponentBundle in the project

  <%= config.bin %> <%= command.id %> --metadata LightningComponentBundle:ComponentName

- Enrich metadata for a select LightningComponentBundle in the project for a specified target org

  <%= config.bin %> <%= command.id %> --metadata LightningComponentBundle:ComponentName --target-org OrgAlias

- Enrich metadata for multiple LightningComponentBundle in the project

  <%= config.bin %> <%= command.id %> --metadata LightningComponentBundle:Component1 --metadata LightningComponentBundle:Component2

- Enrich metadata for multiple LightningComponentBundle in the project matching wildcard

  <%= config.bin %> <%= command.id %> --metadata LightningComponentBundle:Component\*

# flags.metadata.summary

(required) Metadata type and optional component name to enrich.

# flags.metadata.description

Wildcards (_ ) supported as long as you use quotes, such as "LightningComponentBundle:MyClass_".
