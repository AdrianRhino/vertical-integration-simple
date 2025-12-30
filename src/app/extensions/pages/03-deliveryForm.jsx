import { Text, Select } from "@hubspot/ui-extensions";
import { deliveryComponent, deliveryRequiredFields } from "../helperFunctions/helper";
import { renderField } from "../helperFunctions/componentRender";
import AddressDisplay from "../helperFunctions/AddressDisplay";
import { useEffect, useState } from "react";
import { logContractFailure } from "../helperFunctions/debugCheckLogger";

const DeliveryForm = ({ order, setOrder, runServerless, setCanGoNext, fetchCrmObjectProperties }) => {
  const [productionTeam, setProductionTeam] = useState([]);
  const [isAddressEditing, setIsAddressEditing] = useState(false);

  // Load production team when page loads
  useEffect(() => {
    loadProductionTeam();
  }, []);

  // Load address from deal when page loads
  useEffect(() => {
    if (fetchCrmObjectProperties) {
      async function loadAddress() {
        try {
          const properties = await fetchCrmObjectProperties([
            "address_line_1",
            "city",
            "state",
            "zip_code",
          ]);

          // If order doesn't have address yet, use deal address
          if (properties && properties.address_line_1) {
            setOrder((prev) => {
              // Only update if address is not already set
              if (prev.delivery && prev.delivery.address_line_1) {
                return prev;
              }
              return {
                ...prev,
                delivery: {
                  ...prev.delivery,
                  address_line_1: properties.address_line_1 || "",
                  city: properties.city || "",
                  state: properties.state || "",
                  zip_code: properties.zip_code || "",
                },
              };
            });
          }
        } catch (error) {
          logContractFailure({
            contractId: "C-002",
            message: "Failed to load address from CRM object properties",
            expected: { success: true, properties: "object" },
            actual: { message: error.message },
            system: "HubSpot",
            entityType: "Deal",
            operation: "READ",
            trace: ["DeliveryForm", "loadAddress"],
            nextCheck: "Check HubSpot API permissions and deal object properties",
          });
        }
      }
      loadAddress();
    }
  }, [fetchCrmObjectProperties, setOrder]);

  // Simple validation: check if required fields are filled
  useEffect(() => {
    const delivery = order.delivery || {};
    const hasTeam = productionTeam.length > 0;
    
    // Check each required field
    let allFieldsFilled = true;
    for (let i = 0; i < deliveryRequiredFields.length; i++) {
      const fieldName = deliveryRequiredFields[i];
      const value = delivery[fieldName];
      if (!value || value === "") {
        allFieldsFilled = false;
        break;
      }
    }

    setCanGoNext(hasTeam && allFieldsFilled);
  }, [productionTeam.length, order.delivery, setCanGoNext]);

  // Simple function to load production team
  const loadProductionTeam = async () => {
    try {
      const response = await runServerless({ name: "getProductionTeam" });
      setProductionTeam(response.response.body.data || []);
    } catch (error) {
      logContractFailure({
        contractId: "C-002",
        message: "Failed to load production team",
        expected: { success: true, data: "array" },
        actual: { message: error.message },
        system: "HubSpot",
        operation: "READ",
        trace: ["DeliveryForm", "loadProductionTeam"],
        nextCheck: "Check getProductionTeam serverless function and HubSpot API",
      });
    }
  };

  // Simple function to update a field
  const updateField = (fieldName, value) => {
    setOrder((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        [fieldName]: value,
      },
    }));
  };

  return (
    <>
      <Text>Delivery</Text>
      <Select
        label="Primary Contact"
        options={productionTeam}
        value={order.delivery?.primary_contact}
        onChange={(value) => {
          updateField("primary_contact", value);
        }}
      />
      {deliveryComponent
        .filter((field) => !["address_line_1", "city", "state", "zip_code"].includes(field.internalName))
        .map((field) =>
          renderField(
            field,
            null,
            null,
            order.delivery || {},
            updateField,
            null
          )
        )}
      <Text></Text>
      <AddressDisplay
        address={order.delivery || {}}
        onFieldChange={updateField}
        isEditing={isAddressEditing}
        onEdit={() => setIsAddressEditing(true)}
        onSave={() => setIsAddressEditing(false)}
      />
    </>
  );
};

export default DeliveryForm;
