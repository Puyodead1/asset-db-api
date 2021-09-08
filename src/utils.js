const flatten = (obj, path = "") => {
  let output = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isObject(value))
      output = Object.assign(
        output,
        flatten(value, path ? `${path}.${key}` : key)
      );
    else output[path ? `${path}.${key}` : key] = value;
  }
  return output;
};

const isObject = (input) => {
  return input && input.constructor === Object;
};

module.exports = { flatten, isObject };
