// src/components/HartmanLogo.jsx  ← keep the same name
import React from 'react';
import Svg, { Path, Circle, Ellipse, G, Line } from 'react-native-svg';

const HartmanLogo = ({
  width = 120,
  height = 140,
  tintColor,
  color,
  helpMode = false,   // ← defaults to false if you forget
  darkMode = false,   // ← defaults to false if you forget
  ...props
}) => {
  // Final stroke color for all outlines
  const strokeColor = tintColor || color || (helpMode ? '#a855f7' : (darkMode ? '#fbbf24' : '#000000'));

  // Hard-hat fill color (this is the magic part)
  const hatFill = helpMode 
    ? '#f59e0b'                                   // help mode = full amber
    : darkMode 
      ? '#ffffff'                                 // dark mode = white hat
      : '#fbbf24';                                // light mode = classic yellow

  return (
    <Svg viewBox="0 -80 512 592" width={width} height={height} fill="none" {...props}>
      {/* Helmet outline */}
      <Path
        d="M448 225.64v99a64 64 0 01-40.23 59.42l-23.68 9.47A32 32 0 00364.6 417l-10 50.14A16 16 0 01338.88 480H173.12a16 16 0 01-15.69-12.86L147.4 417a32 32 0 00-19.49-23.44l-23.68-9.47A64 64 0 0164 324.67V224c0-105.92 85.77-191.81 191.65-192S448 119.85 448 225.64z"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeMiterlimit="10"
        strokeWidth="32"
      />

      <Circle cx="168" cy="280" r="40" stroke={strokeColor} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32" />
      <Circle cx="344" cy="280" r="40" stroke={strokeColor} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32" />

      <Path
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
        d="M256 336l-16 48h32l-16-48zM256 448v32M208 448v32M304 448v32"
      />

      <G transform="translate(256, -86) scale(1.1) translate(-256, 0)">
        <Ellipse cx="256" cy="246" rx="230" ry="36" fill={hatFill} stroke={strokeColor} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32" />
        <Ellipse cx="256" cy="236" rx="230" ry="36" fill={hatFill} stroke={strokeColor} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="14" />
        <Ellipse cx="256" cy="236" rx="230" ry="36" stroke="#000" strokeWidth="14" />
        <Path
          d="M88 200v-20c0-74 76-136 168-136s168 62 168 136v20c0 20-16 36-36 36H124c-20 0-36-16-36-36z"
          fill={hatFill}
          stroke={strokeColor}
          strokeLinecap="round"
          strokeMiterlimit="10"
          strokeWidth="14"
        />
        
        <Path d="M200 160c0-16 25-28 56-28s56 12 56 28" stroke="#000" strokeWidth="14" strokeLinecap="round" fill="none" />
        <Line x1="120" y1="170" x2="120" y2="210" stroke="#000" strokeWidth="14" strokeLinecap="round" />
        <Line x1="392" y1="170" x2="392" y2="210" stroke="#000" strokeWidth="14" strokeLinecap="round" />
      </G>
    </Svg>
  );
};

export default HartmanLogo;
