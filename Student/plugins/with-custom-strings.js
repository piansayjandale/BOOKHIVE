const { withStringsXml } = require('@expo/config-plugins');

const withCustomStrings = (config) => {
  return withStringsXml(config, (modConfig) => {
    const strings = modConfig.modResults.resources.string || [];

    // uCrop resource keys we want to override
    const keysToOverride = {
      'ucrop_crop': 'done',
      'ucrop_menu_crop': 'done',
    };

    // Remove existing keys to avoid duplicates
    const filteredStrings = strings.filter(
      (item) => !item.$.name || !keysToOverride[item.$.name]
    );

    // Add overridden keys
    Object.keys(keysToOverride).forEach((key) => {
      filteredStrings.push({
        $: { name: key },
        _: keysToOverride[key],
      });
    });

    modConfig.modResults.resources.string = filteredStrings;
    return modConfig;
  });
};

module.exports = withCustomStrings;
