"use client";

import { useEffect } from "react";

import useSWR from "swr";

export default function Test() {
  const fetcher = () => {
    return "test";
  };
  const { data } = useSWR("/rooms123", fetcher);
  console.log("data", data);

  useEffect(() => {
    console.log("EFFECT: data changed to:", data);
    // You could potentially do something here only when data is defined
    if (data) {
      console.log("EFFECT: Data is now defined:", data);
    }
  }, [data]); // Dependency array ensures this runs when 'data' changes

  return <div>This should say test almost immediately: {data}</div>;
}
