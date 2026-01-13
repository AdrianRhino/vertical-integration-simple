// SHAPE: Input → Filter → Transform → Store → Output → Loop
// INPUT: Config-driven API endpoints organized by supplier and environment
// FILTER: Enabled endpoints per supplier/environment
// TRANSFORM: Generate test UI for each endpoint
// STORE: Test results per endpoint
// OUTPUT: Organized display by supplier → environment → endpoint
// LOOP: Allow individual endpoint testing

import { useState } from "react";
import {
  Text,
  Heading,
  Button,
  Divider,
} from "@hubspot/ui-extensions";
import { hubspot } from "@hubspot/ui-extensions";


const API_Test_Page = ({
  setOrder,
  order,
  context,
  setStatus,
  clearOrder,
  setCurrentPage,
  setCanGoNext,
}) => {
  
    return (
      <>
      <Heading>API Test Page</Heading>
      <Divider />
      <Text>ABC Login</Text>
      <Button>Sandbox Login</Button>
      <Button>Production Login</Button>
      <Text></Text>
      <Text>ABC Product</Text>
      <Button>Sandbox Product</Button>
      <Button>Production Product</Button>
      <Text></Text>
      <Text>ABC Order</Text>
      <Button>Sandbox Order</Button>
      <Button>Production Order</Button>
      <Text></Text>
      <Text>ABC Pricing</Text>
      <Button>Sandbox Pricing</Button>
      <Button>Production Pricing</Button>
      <Text></Text>
      <Divider />
      <Text>SRS Login</Text>
      <Button>Sandbox Login</Button>
      <Button>Production Login</Button>
      <Text></Text>
      <Text>SRS Product</Text>
      <Button>Sandbox Product</Button>
      <Button>Production Product</Button>
      <Text></Text>
      <Text>SRS Order</Text>
      <Button>Sandbox Order</Button>
      <Button>Production Order</Button>
      <Text></Text>
      <Text>SRS Pricing</Text>
      <Button>Sandbox Pricing</Button>
      <Button>Production Pricing</Button>
      <Text></Text>
      <Divider />
      <Text>Beacon Login</Text>
      <Button>Sandbox Login</Button>
      <Button>Production Login</Button>
      <Text></Text>
      <Text>Beacon Product</Text>
      <Button>Sandbox Product</Button>
      <Button>Production Product</Button>
      <Text></Text>
      <Text>Beacon Pricing</Text>
      <Button>Sandbox Pricing</Button>
      <Button>Production Pricing</Button>
      <Text></Text>
      <Text>Beacon Order</Text>
      <Button>Sandbox Order</Button>
      <Button>Production Order</Button>
      <Text></Text>
      </>
    );
  };

export default API_Test_Page;