const mongoose = require('mongoose');

const norwayMunicipalitySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    countyCode: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NorwayMunicipality', norwayMunicipalitySchema);
