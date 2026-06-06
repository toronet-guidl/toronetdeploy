# Steps

## Format files

Format files so that the `ci` script does not fail

```bash
npm run format
```

## Run Prepublish

```bash
npm run prepublishOnly
```

## Create version changeset

Enter the description of the changes made in this version

```bash
npm run create-changeset
```

## Publish the new version

Publish the new version to the npm registry

```bash
npm run local-release
```
