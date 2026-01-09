import { useState, useEffect } from "react";
import { Text, Select } from "@hubspot/ui-extensions";
import { hubspot } from "@hubspot/ui-extensions";
import { appOptions } from "../helperFunctions/appOptions";
import { logContractFailure } from "../helperFunctions/debugCheckLogger";

// SHAPE: Input → Filter → Transform → Store → Output → Loop
// INPUT: order, context, setStatus, clearOrder, setCurrentPage, setCanGoNext
// FILTER: validate order has required fields
// TRANSFORM: convert to unified format, then to ABC format
// STORE: ABC request payload
// OUTPUT: send to sandbox API
// LOOP: display result, allow retry

const API_Test_Page = ({ setOrder, order, context, setStatus, clearOrder, setCurrentPage, setCanGoNext }) => {
    return (
        <>
            <Text>API Test Page</Text>
        </>
    )
}

export default API_Test_Page;