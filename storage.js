function getSavedUnits() {
  return JSON.parse(localStorage.getItem("units") || "[]");
}

function saveUnit(unit) {
  const units = getSavedUnits();
  units.push(unit);
  localStorage.setItem("units", JSON.stringify(units));
}
function createUnit(surface, context, type = "") {
  return {
    surface,
    context,
    type
  };
}
function deleteUnit(index) {
  const units = getSavedUnits();
  units.splice(index, 1);
  localStorage.setItem("units", JSON.stringify(units));
}