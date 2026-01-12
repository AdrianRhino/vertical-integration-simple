import React from "react";
import { hubspot, Button } from "@hubspot/ui-extensions";

const SrsLogin = () => {
  const testSrsLogin = async () => {
    const response = await hubspot.serverless("srsLogin");
    console.log("SRS Login response:", response);
  };

  return (
    <>
      <Button onClick={testSrsLogin}>Test SRS Login</Button>
    </>
  );
};

export default SrsLogin;
