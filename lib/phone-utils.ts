// lib/phone-utils.ts

// Comprehensive list of country codes with dial codes and flags
export const COUNTRY_CODES = [
  // Popular countries first (for better UX)
  {
    code: '+61',
    country: 'AU',
    label: '🇦🇺 Australia (+61)',
    flag: '🇦🇺',
    name: 'Australia',
  },
  {
    code: '+1',
    country: 'US',
    label: '🇺🇸 United States (+1)',
    flag: '🇺🇸',
    name: 'United States',
  },
  {
    code: '+44',
    country: 'GB',
    label: '🇬🇧 United Kingdom (+44)',
    flag: '🇬🇧',
    name: 'United Kingdom',
  },
  {
    code: '+64',
    country: 'NZ',
    label: '🇳🇿 New Zealand (+64)',
    flag: '🇳🇿',
    name: 'New Zealand',
  },
  {
    code: '+65',
    country: 'SG',
    label: '🇸🇬 Singapore (+65)',
    flag: '🇸🇬',
    name: 'Singapore',
  },
  {
    code: '+1',
    country: 'CA',
    label: '🇨🇦 Canada (+1)',
    flag: '🇨🇦',
    name: 'Canada',
  },

  // Divider - rest alphabetically
  {
    code: '+93',
    country: 'AF',
    label: '🇦🇫 Afghanistan (+93)',
    flag: '🇦🇫',
    name: 'Afghanistan',
  },
  {
    code: '+355',
    country: 'AL',
    label: '🇦🇱 Albania (+355)',
    flag: '🇦🇱',
    name: 'Albania',
  },
  {
    code: '+213',
    country: 'DZ',
    label: '🇩🇿 Algeria (+213)',
    flag: '🇩🇿',
    name: 'Algeria',
  },
  {
    code: '+376',
    country: 'AD',
    label: '🇦🇩 Andorra (+376)',
    flag: '🇦🇩',
    name: 'Andorra',
  },
  {
    code: '+244',
    country: 'AO',
    label: '🇦🇴 Angola (+244)',
    flag: '🇦🇴',
    name: 'Angola',
  },
  {
    code: '+54',
    country: 'AR',
    label: '🇦🇷 Argentina (+54)',
    flag: '🇦🇷',
    name: 'Argentina',
  },
  {
    code: '+374',
    country: 'AM',
    label: '🇦🇲 Armenia (+374)',
    flag: '🇦🇲',
    name: 'Armenia',
  },
  {
    code: '+43',
    country: 'AT',
    label: '🇦🇹 Austria (+43)',
    flag: '🇦🇹',
    name: 'Austria',
  },
  {
    code: '+994',
    country: 'AZ',
    label: '🇦🇿 Azerbaijan (+994)',
    flag: '🇦🇿',
    name: 'Azerbaijan',
  },
  {
    code: '+973',
    country: 'BH',
    label: '🇧🇭 Bahrain (+973)',
    flag: '🇧🇭',
    name: 'Bahrain',
  },
  {
    code: '+880',
    country: 'BD',
    label: '🇧🇩 Bangladesh (+880)',
    flag: '🇧🇩',
    name: 'Bangladesh',
  },
  {
    code: '+375',
    country: 'BY',
    label: '🇧🇾 Belarus (+375)',
    flag: '🇧🇾',
    name: 'Belarus',
  },
  {
    code: '+32',
    country: 'BE',
    label: '🇧🇪 Belgium (+32)',
    flag: '🇧🇪',
    name: 'Belgium',
  },
  {
    code: '+501',
    country: 'BZ',
    label: '🇧🇿 Belize (+501)',
    flag: '🇧🇿',
    name: 'Belize',
  },
  {
    code: '+229',
    country: 'BJ',
    label: '🇧🇯 Benin (+229)',
    flag: '🇧🇯',
    name: 'Benin',
  },
  {
    code: '+975',
    country: 'BT',
    label: '🇧🇹 Bhutan (+975)',
    flag: '🇧🇹',
    name: 'Bhutan',
  },
  {
    code: '+591',
    country: 'BO',
    label: '🇧🇴 Bolivia (+591)',
    flag: '🇧🇴',
    name: 'Bolivia',
  },
  {
    code: '+387',
    country: 'BA',
    label: '🇧🇦 Bosnia (+387)',
    flag: '🇧🇦',
    name: 'Bosnia and Herzegovina',
  },
  {
    code: '+267',
    country: 'BW',
    label: '🇧🇼 Botswana (+267)',
    flag: '🇧🇼',
    name: 'Botswana',
  },
  {
    code: '+55',
    country: 'BR',
    label: '🇧🇷 Brazil (+55)',
    flag: '🇧🇷',
    name: 'Brazil',
  },
  {
    code: '+673',
    country: 'BN',
    label: '🇧🇳 Brunei (+673)',
    flag: '🇧🇳',
    name: 'Brunei',
  },
  {
    code: '+359',
    country: 'BG',
    label: '🇧🇬 Bulgaria (+359)',
    flag: '🇧🇬',
    name: 'Bulgaria',
  },
  {
    code: '+226',
    country: 'BF',
    label: '🇧🇫 Burkina Faso (+226)',
    flag: '🇧🇫',
    name: 'Burkina Faso',
  },
  {
    code: '+257',
    country: 'BI',
    label: '🇧🇮 Burundi (+257)',
    flag: '🇧🇮',
    name: 'Burundi',
  },
  {
    code: '+855',
    country: 'KH',
    label: '🇰🇭 Cambodia (+855)',
    flag: '🇰🇭',
    name: 'Cambodia',
  },
  {
    code: '+237',
    country: 'CM',
    label: '🇨🇲 Cameroon (+237)',
    flag: '🇨🇲',
    name: 'Cameroon',
  },
  {
    code: '+238',
    country: 'CV',
    label: '🇨🇻 Cape Verde (+238)',
    flag: '🇨🇻',
    name: 'Cape Verde',
  },
  {
    code: '+236',
    country: 'CF',
    label: '🇨🇫 Central African Republic (+236)',
    flag: '🇨🇫',
    name: 'Central African Republic',
  },
  {
    code: '+235',
    country: 'TD',
    label: '🇹🇩 Chad (+235)',
    flag: '🇹🇩',
    name: 'Chad',
  },
  {
    code: '+56',
    country: 'CL',
    label: '🇨🇱 Chile (+56)',
    flag: '🇨🇱',
    name: 'Chile',
  },
  {
    code: '+86',
    country: 'CN',
    label: '🇨🇳 China (+86)',
    flag: '🇨🇳',
    name: 'China',
  },
  {
    code: '+57',
    country: 'CO',
    label: '🇨🇴 Colombia (+57)',
    flag: '🇨🇴',
    name: 'Colombia',
  },
  {
    code: '+269',
    country: 'KM',
    label: '🇰🇲 Comoros (+269)',
    flag: '🇰🇲',
    name: 'Comoros',
  },
  {
    code: '+242',
    country: 'CG',
    label: '🇨🇬 Congo (+242)',
    flag: '🇨🇬',
    name: 'Congo',
  },
  {
    code: '+243',
    country: 'CD',
    label: '🇨🇩 Congo DR (+243)',
    flag: '🇨🇩',
    name: 'Congo (DRC)',
  },
  {
    code: '+506',
    country: 'CR',
    label: '🇨🇷 Costa Rica (+506)',
    flag: '🇨🇷',
    name: 'Costa Rica',
  },
  {
    code: '+385',
    country: 'HR',
    label: '🇭🇷 Croatia (+385)',
    flag: '🇭🇷',
    name: 'Croatia',
  },
  {
    code: '+53',
    country: 'CU',
    label: '🇨🇺 Cuba (+53)',
    flag: '🇨🇺',
    name: 'Cuba',
  },
  {
    code: '+357',
    country: 'CY',
    label: '🇨🇾 Cyprus (+357)',
    flag: '🇨🇾',
    name: 'Cyprus',
  },
  {
    code: '+420',
    country: 'CZ',
    label: '🇨🇿 Czech Republic (+420)',
    flag: '🇨🇿',
    name: 'Czech Republic',
  },
  {
    code: '+45',
    country: 'DK',
    label: '🇩🇰 Denmark (+45)',
    flag: '🇩🇰',
    name: 'Denmark',
  },
  {
    code: '+253',
    country: 'DJ',
    label: '🇩🇯 Djibouti (+253)',
    flag: '🇩🇯',
    name: 'Djibouti',
  },
  {
    code: '+593',
    country: 'EC',
    label: '🇪🇨 Ecuador (+593)',
    flag: '🇪🇨',
    name: 'Ecuador',
  },
  {
    code: '+20',
    country: 'EG',
    label: '🇪🇬 Egypt (+20)',
    flag: '🇪🇬',
    name: 'Egypt',
  },
  {
    code: '+503',
    country: 'SV',
    label: '🇸🇻 El Salvador (+503)',
    flag: '🇸🇻',
    name: 'El Salvador',
  },
  {
    code: '+240',
    country: 'GQ',
    label: '🇬🇶 Equatorial Guinea (+240)',
    flag: '🇬🇶',
    name: 'Equatorial Guinea',
  },
  {
    code: '+291',
    country: 'ER',
    label: '🇪🇷 Eritrea (+291)',
    flag: '🇪🇷',
    name: 'Eritrea',
  },
  {
    code: '+372',
    country: 'EE',
    label: '🇪🇪 Estonia (+372)',
    flag: '🇪🇪',
    name: 'Estonia',
  },
  {
    code: '+268',
    country: 'SZ',
    label: '🇸🇿 Eswatini (+268)',
    flag: '🇸🇿',
    name: 'Eswatini',
  },
  {
    code: '+251',
    country: 'ET',
    label: '🇪🇹 Ethiopia (+251)',
    flag: '🇪🇹',
    name: 'Ethiopia',
  },
  {
    code: '+679',
    country: 'FJ',
    label: '🇫🇯 Fiji (+679)',
    flag: '🇫🇯',
    name: 'Fiji',
  },
  {
    code: '+358',
    country: 'FI',
    label: '🇫🇮 Finland (+358)',
    flag: '🇫🇮',
    name: 'Finland',
  },
  {
    code: '+33',
    country: 'FR',
    label: '🇫🇷 France (+33)',
    flag: '🇫🇷',
    name: 'France',
  },
  {
    code: '+241',
    country: 'GA',
    label: '🇬🇦 Gabon (+241)',
    flag: '🇬🇦',
    name: 'Gabon',
  },
  {
    code: '+220',
    country: 'GM',
    label: '🇬🇲 Gambia (+220)',
    flag: '🇬🇲',
    name: 'Gambia',
  },
  {
    code: '+995',
    country: 'GE',
    label: '🇬🇪 Georgia (+995)',
    flag: '🇬🇪',
    name: 'Georgia',
  },
  {
    code: '+49',
    country: 'DE',
    label: '🇩🇪 Germany (+49)',
    flag: '🇩🇪',
    name: 'Germany',
  },
  {
    code: '+233',
    country: 'GH',
    label: '🇬🇭 Ghana (+233)',
    flag: '🇬🇭',
    name: 'Ghana',
  },
  {
    code: '+30',
    country: 'GR',
    label: '🇬🇷 Greece (+30)',
    flag: '🇬🇷',
    name: 'Greece',
  },
  {
    code: '+502',
    country: 'GT',
    label: '🇬🇹 Guatemala (+502)',
    flag: '🇬🇹',
    name: 'Guatemala',
  },
  {
    code: '+224',
    country: 'GN',
    label: '🇬🇳 Guinea (+224)',
    flag: '🇬🇳',
    name: 'Guinea',
  },
  {
    code: '+245',
    country: 'GW',
    label: '🇬🇼 Guinea-Bissau (+245)',
    flag: '🇬🇼',
    name: 'Guinea-Bissau',
  },
  {
    code: '+592',
    country: 'GY',
    label: '🇬🇾 Guyana (+592)',
    flag: '🇬🇾',
    name: 'Guyana',
  },
  {
    code: '+509',
    country: 'HT',
    label: '🇭🇹 Haiti (+509)',
    flag: '🇭🇹',
    name: 'Haiti',
  },
  {
    code: '+504',
    country: 'HN',
    label: '🇭🇳 Honduras (+504)',
    flag: '🇭🇳',
    name: 'Honduras',
  },
  {
    code: '+852',
    country: 'HK',
    label: '🇭🇰 Hong Kong (+852)',
    flag: '🇭🇰',
    name: 'Hong Kong',
  },
  {
    code: '+36',
    country: 'HU',
    label: '🇭🇺 Hungary (+36)',
    flag: '🇭🇺',
    name: 'Hungary',
  },
  {
    code: '+354',
    country: 'IS',
    label: '🇮🇸 Iceland (+354)',
    flag: '🇮🇸',
    name: 'Iceland',
  },
  {
    code: '+91',
    country: 'IN',
    label: '🇮🇳 India (+91)',
    flag: '🇮🇳',
    name: 'India',
  },
  {
    code: '+62',
    country: 'ID',
    label: '🇮🇩 Indonesia (+62)',
    flag: '🇮🇩',
    name: 'Indonesia',
  },
  {
    code: '+98',
    country: 'IR',
    label: '🇮🇷 Iran (+98)',
    flag: '🇮🇷',
    name: 'Iran',
  },
  {
    code: '+964',
    country: 'IQ',
    label: '🇮🇶 Iraq (+964)',
    flag: '🇮🇶',
    name: 'Iraq',
  },
  {
    code: '+353',
    country: 'IE',
    label: '🇮🇪 Ireland (+353)',
    flag: '🇮🇪',
    name: 'Ireland',
  },
  {
    code: '+972',
    country: 'IL',
    label: '🇮🇱 Israel (+972)',
    flag: '🇮🇱',
    name: 'Israel',
  },
  {
    code: '+39',
    country: 'IT',
    label: '🇮🇹 Italy (+39)',
    flag: '🇮🇹',
    name: 'Italy',
  },
  {
    code: '+225',
    country: 'CI',
    label: '🇨🇮 Ivory Coast (+225)',
    flag: '🇨🇮',
    name: 'Ivory Coast',
  },
  {
    code: '+81',
    country: 'JP',
    label: '🇯🇵 Japan (+81)',
    flag: '🇯🇵',
    name: 'Japan',
  },
  {
    code: '+962',
    country: 'JO',
    label: '🇯🇴 Jordan (+962)',
    flag: '🇯🇴',
    name: 'Jordan',
  },
  {
    code: '+7',
    country: 'KZ',
    label: '🇰🇿 Kazakhstan (+7)',
    flag: '🇰🇿',
    name: 'Kazakhstan',
  },
  {
    code: '+254',
    country: 'KE',
    label: '🇰🇪 Kenya (+254)',
    flag: '🇰🇪',
    name: 'Kenya',
  },
  {
    code: '+686',
    country: 'KI',
    label: '🇰🇮 Kiribati (+686)',
    flag: '🇰🇮',
    name: 'Kiribati',
  },
  {
    code: '+965',
    country: 'KW',
    label: '🇰🇼 Kuwait (+965)',
    flag: '🇰🇼',
    name: 'Kuwait',
  },
  {
    code: '+996',
    country: 'KG',
    label: '🇰🇬 Kyrgyzstan (+996)',
    flag: '🇰🇬',
    name: 'Kyrgyzstan',
  },
  {
    code: '+856',
    country: 'LA',
    label: '🇱🇦 Laos (+856)',
    flag: '🇱🇦',
    name: 'Laos',
  },
  {
    code: '+371',
    country: 'LV',
    label: '🇱🇻 Latvia (+371)',
    flag: '🇱🇻',
    name: 'Latvia',
  },
  {
    code: '+961',
    country: 'LB',
    label: '🇱🇧 Lebanon (+961)',
    flag: '🇱🇧',
    name: 'Lebanon',
  },
  {
    code: '+266',
    country: 'LS',
    label: '🇱🇸 Lesotho (+266)',
    flag: '🇱🇸',
    name: 'Lesotho',
  },
  {
    code: '+231',
    country: 'LR',
    label: '🇱🇷 Liberia (+231)',
    flag: '🇱🇷',
    name: 'Liberia',
  },
  {
    code: '+218',
    country: 'LY',
    label: '🇱🇾 Libya (+218)',
    flag: '🇱🇾',
    name: 'Libya',
  },
  {
    code: '+423',
    country: 'LI',
    label: '🇱🇮 Liechtenstein (+423)',
    flag: '🇱🇮',
    name: 'Liechtenstein',
  },
  {
    code: '+370',
    country: 'LT',
    label: '🇱🇹 Lithuania (+370)',
    flag: '🇱🇹',
    name: 'Lithuania',
  },
  {
    code: '+352',
    country: 'LU',
    label: '🇱🇺 Luxembourg (+352)',
    flag: '🇱🇺',
    name: 'Luxembourg',
  },
  {
    code: '+853',
    country: 'MO',
    label: '🇲🇴 Macau (+853)',
    flag: '🇲🇴',
    name: 'Macau',
  },
  {
    code: '+261',
    country: 'MG',
    label: '🇲🇬 Madagascar (+261)',
    flag: '🇲🇬',
    name: 'Madagascar',
  },
  {
    code: '+265',
    country: 'MW',
    label: '🇲🇼 Malawi (+265)',
    flag: '🇲🇼',
    name: 'Malawi',
  },
  {
    code: '+60',
    country: 'MY',
    label: '🇲🇾 Malaysia (+60)',
    flag: '🇲🇾',
    name: 'Malaysia',
  },
  {
    code: '+960',
    country: 'MV',
    label: '🇲🇻 Maldives (+960)',
    flag: '🇲🇻',
    name: 'Maldives',
  },
  {
    code: '+223',
    country: 'ML',
    label: '🇲🇱 Mali (+223)',
    flag: '🇲🇱',
    name: 'Mali',
  },
  {
    code: '+356',
    country: 'MT',
    label: '🇲🇹 Malta (+356)',
    flag: '🇲🇹',
    name: 'Malta',
  },
  {
    code: '+692',
    country: 'MH',
    label: '🇲🇭 Marshall Islands (+692)',
    flag: '🇲🇭',
    name: 'Marshall Islands',
  },
  {
    code: '+222',
    country: 'MR',
    label: '🇲🇷 Mauritania (+222)',
    flag: '🇲🇷',
    name: 'Mauritania',
  },
  {
    code: '+230',
    country: 'MU',
    label: '🇲🇺 Mauritius (+230)',
    flag: '🇲🇺',
    name: 'Mauritius',
  },
  {
    code: '+52',
    country: 'MX',
    label: '🇲🇽 Mexico (+52)',
    flag: '🇲🇽',
    name: 'Mexico',
  },
  {
    code: '+691',
    country: 'FM',
    label: '🇫🇲 Micronesia (+691)',
    flag: '🇫🇲',
    name: 'Micronesia',
  },
  {
    code: '+373',
    country: 'MD',
    label: '🇲🇩 Moldova (+373)',
    flag: '🇲🇩',
    name: 'Moldova',
  },
  {
    code: '+377',
    country: 'MC',
    label: '🇲🇨 Monaco (+377)',
    flag: '🇲🇨',
    name: 'Monaco',
  },
  {
    code: '+976',
    country: 'MN',
    label: '🇲🇳 Mongolia (+976)',
    flag: '🇲🇳',
    name: 'Mongolia',
  },
  {
    code: '+382',
    country: 'ME',
    label: '🇲🇪 Montenegro (+382)',
    flag: '🇲🇪',
    name: 'Montenegro',
  },
  {
    code: '+212',
    country: 'MA',
    label: '🇲🇦 Morocco (+212)',
    flag: '🇲🇦',
    name: 'Morocco',
  },
  {
    code: '+258',
    country: 'MZ',
    label: '🇲🇿 Mozambique (+258)',
    flag: '🇲🇿',
    name: 'Mozambique',
  },
  {
    code: '+95',
    country: 'MM',
    label: '🇲🇲 Myanmar (+95)',
    flag: '🇲🇲',
    name: 'Myanmar',
  },
  {
    code: '+264',
    country: 'NA',
    label: '🇳🇦 Namibia (+264)',
    flag: '🇳🇦',
    name: 'Namibia',
  },
  {
    code: '+674',
    country: 'NR',
    label: '🇳🇷 Nauru (+674)',
    flag: '🇳🇷',
    name: 'Nauru',
  },
  {
    code: '+977',
    country: 'NP',
    label: '🇳🇵 Nepal (+977)',
    flag: '🇳🇵',
    name: 'Nepal',
  },
  {
    code: '+31',
    country: 'NL',
    label: '🇳🇱 Netherlands (+31)',
    flag: '🇳🇱',
    name: 'Netherlands',
  },
  {
    code: '+505',
    country: 'NI',
    label: '🇳🇮 Nicaragua (+505)',
    flag: '🇳🇮',
    name: 'Nicaragua',
  },
  {
    code: '+227',
    country: 'NE',
    label: '🇳🇪 Niger (+227)',
    flag: '🇳🇪',
    name: 'Niger',
  },
  {
    code: '+234',
    country: 'NG',
    label: '🇳🇬 Nigeria (+234)',
    flag: '🇳🇬',
    name: 'Nigeria',
  },
  {
    code: '+850',
    country: 'KP',
    label: '🇰🇵 North Korea (+850)',
    flag: '🇰🇵',
    name: 'North Korea',
  },
  {
    code: '+389',
    country: 'MK',
    label: '🇲🇰 North Macedonia (+389)',
    flag: '🇲🇰',
    name: 'North Macedonia',
  },
  {
    code: '+47',
    country: 'NO',
    label: '🇳🇴 Norway (+47)',
    flag: '🇳🇴',
    name: 'Norway',
  },
  {
    code: '+968',
    country: 'OM',
    label: '🇴🇲 Oman (+968)',
    flag: '🇴🇲',
    name: 'Oman',
  },
  {
    code: '+92',
    country: 'PK',
    label: '🇵🇰 Pakistan (+92)',
    flag: '🇵🇰',
    name: 'Pakistan',
  },
  {
    code: '+680',
    country: 'PW',
    label: '🇵🇼 Palau (+680)',
    flag: '🇵🇼',
    name: 'Palau',
  },
  {
    code: '+970',
    country: 'PS',
    label: '🇵🇸 Palestine (+970)',
    flag: '🇵🇸',
    name: 'Palestine',
  },
  {
    code: '+507',
    country: 'PA',
    label: '🇵🇦 Panama (+507)',
    flag: '🇵🇦',
    name: 'Panama',
  },
  {
    code: '+675',
    country: 'PG',
    label: '🇵🇬 Papua New Guinea (+675)',
    flag: '🇵🇬',
    name: 'Papua New Guinea',
  },
  {
    code: '+595',
    country: 'PY',
    label: '🇵🇾 Paraguay (+595)',
    flag: '🇵🇾',
    name: 'Paraguay',
  },
  {
    code: '+51',
    country: 'PE',
    label: '🇵🇪 Peru (+51)',
    flag: '🇵🇪',
    name: 'Peru',
  },
  {
    code: '+63',
    country: 'PH',
    label: '🇵🇭 Philippines (+63)',
    flag: '🇵🇭',
    name: 'Philippines',
  },
  {
    code: '+48',
    country: 'PL',
    label: '🇵🇱 Poland (+48)',
    flag: '🇵🇱',
    name: 'Poland',
  },
  {
    code: '+351',
    country: 'PT',
    label: '🇵🇹 Portugal (+351)',
    flag: '🇵🇹',
    name: 'Portugal',
  },
  {
    code: '+974',
    country: 'QA',
    label: '🇶🇦 Qatar (+974)',
    flag: '🇶🇦',
    name: 'Qatar',
  },
  {
    code: '+40',
    country: 'RO',
    label: '🇷🇴 Romania (+40)',
    flag: '🇷🇴',
    name: 'Romania',
  },
  {
    code: '+7',
    country: 'RU',
    label: '🇷🇺 Russia (+7)',
    flag: '🇷🇺',
    name: 'Russia',
  },
  {
    code: '+250',
    country: 'RW',
    label: '🇷🇼 Rwanda (+250)',
    flag: '🇷🇼',
    name: 'Rwanda',
  },
  {
    code: '+685',
    country: 'WS',
    label: '🇼🇸 Samoa (+685)',
    flag: '🇼🇸',
    name: 'Samoa',
  },
  {
    code: '+378',
    country: 'SM',
    label: '🇸🇲 San Marino (+378)',
    flag: '🇸🇲',
    name: 'San Marino',
  },
  {
    code: '+239',
    country: 'ST',
    label: '🇸🇹 São Tomé (+239)',
    flag: '🇸🇹',
    name: 'São Tomé and Príncipe',
  },
  {
    code: '+966',
    country: 'SA',
    label: '🇸🇦 Saudi Arabia (+966)',
    flag: '🇸🇦',
    name: 'Saudi Arabia',
  },
  {
    code: '+221',
    country: 'SN',
    label: '🇸🇳 Senegal (+221)',
    flag: '🇸🇳',
    name: 'Senegal',
  },
  {
    code: '+381',
    country: 'RS',
    label: '🇷🇸 Serbia (+381)',
    flag: '🇷🇸',
    name: 'Serbia',
  },
  {
    code: '+248',
    country: 'SC',
    label: '🇸🇨 Seychelles (+248)',
    flag: '🇸🇨',
    name: 'Seychelles',
  },
  {
    code: '+232',
    country: 'SL',
    label: '🇸🇱 Sierra Leone (+232)',
    flag: '🇸🇱',
    name: 'Sierra Leone',
  },
  {
    code: '+421',
    country: 'SK',
    label: '🇸🇰 Slovakia (+421)',
    flag: '🇸🇰',
    name: 'Slovakia',
  },
  {
    code: '+386',
    country: 'SI',
    label: '🇸🇮 Slovenia (+386)',
    flag: '🇸🇮',
    name: 'Slovenia',
  },
  {
    code: '+677',
    country: 'SB',
    label: '🇸🇧 Solomon Islands (+677)',
    flag: '🇸🇧',
    name: 'Solomon Islands',
  },
  {
    code: '+252',
    country: 'SO',
    label: '🇸🇴 Somalia (+252)',
    flag: '🇸🇴',
    name: 'Somalia',
  },
  {
    code: '+27',
    country: 'ZA',
    label: '🇿🇦 South Africa (+27)',
    flag: '🇿🇦',
    name: 'South Africa',
  },
  {
    code: '+82',
    country: 'KR',
    label: '🇰🇷 South Korea (+82)',
    flag: '🇰🇷',
    name: 'South Korea',
  },
  {
    code: '+211',
    country: 'SS',
    label: '🇸🇸 South Sudan (+211)',
    flag: '🇸🇸',
    name: 'South Sudan',
  },
  {
    code: '+34',
    country: 'ES',
    label: '🇪🇸 Spain (+34)',
    flag: '🇪🇸',
    name: 'Spain',
  },
  {
    code: '+94',
    country: 'LK',
    label: '🇱🇰 Sri Lanka (+94)',
    flag: '🇱🇰',
    name: 'Sri Lanka',
  },
  {
    code: '+249',
    country: 'SD',
    label: '🇸🇩 Sudan (+249)',
    flag: '🇸🇩',
    name: 'Sudan',
  },
  {
    code: '+597',
    country: 'SR',
    label: '🇸🇷 Suriname (+597)',
    flag: '🇸🇷',
    name: 'Suriname',
  },
  {
    code: '+46',
    country: 'SE',
    label: '🇸🇪 Sweden (+46)',
    flag: '🇸🇪',
    name: 'Sweden',
  },
  {
    code: '+41',
    country: 'CH',
    label: '🇨🇭 Switzerland (+41)',
    flag: '🇨🇭',
    name: 'Switzerland',
  },
  {
    code: '+963',
    country: 'SY',
    label: '🇸🇾 Syria (+963)',
    flag: '🇸🇾',
    name: 'Syria',
  },
  {
    code: '+886',
    country: 'TW',
    label: '🇹🇼 Taiwan (+886)',
    flag: '🇹🇼',
    name: 'Taiwan',
  },
  {
    code: '+992',
    country: 'TJ',
    label: '🇹🇯 Tajikistan (+992)',
    flag: '🇹🇯',
    name: 'Tajikistan',
  },
  {
    code: '+255',
    country: 'TZ',
    label: '🇹🇿 Tanzania (+255)',
    flag: '🇹🇿',
    name: 'Tanzania',
  },
  {
    code: '+66',
    country: 'TH',
    label: '🇹🇭 Thailand (+66)',
    flag: '🇹🇭',
    name: 'Thailand',
  },
  {
    code: '+670',
    country: 'TL',
    label: '🇹🇱 Timor-Leste (+670)',
    flag: '🇹🇱',
    name: 'Timor-Leste',
  },
  {
    code: '+228',
    country: 'TG',
    label: '🇹🇬 Togo (+228)',
    flag: '🇹🇬',
    name: 'Togo',
  },
  {
    code: '+676',
    country: 'TO',
    label: '🇹🇴 Tonga (+676)',
    flag: '🇹🇴',
    name: 'Tonga',
  },
  {
    code: '+216',
    country: 'TN',
    label: '🇹🇳 Tunisia (+216)',
    flag: '🇹🇳',
    name: 'Tunisia',
  },
  {
    code: '+90',
    country: 'TR',
    label: '🇹🇷 Turkey (+90)',
    flag: '🇹🇷',
    name: 'Turkey',
  },
  {
    code: '+993',
    country: 'TM',
    label: '🇹🇲 Turkmenistan (+993)',
    flag: '🇹🇲',
    name: 'Turkmenistan',
  },
  {
    code: '+688',
    country: 'TV',
    label: '🇹🇻 Tuvalu (+688)',
    flag: '🇹🇻',
    name: 'Tuvalu',
  },
  {
    code: '+256',
    country: 'UG',
    label: '🇺🇬 Uganda (+256)',
    flag: '🇺🇬',
    name: 'Uganda',
  },
  {
    code: '+380',
    country: 'UA',
    label: '🇺🇦 Ukraine (+380)',
    flag: '🇺🇦',
    name: 'Ukraine',
  },
  {
    code: '+971',
    country: 'AE',
    label: '🇦🇪 UAE (+971)',
    flag: '🇦🇪',
    name: 'United Arab Emirates',
  },
  {
    code: '+598',
    country: 'UY',
    label: '🇺🇾 Uruguay (+598)',
    flag: '🇺🇾',
    name: 'Uruguay',
  },
  {
    code: '+998',
    country: 'UZ',
    label: '🇺🇿 Uzbekistan (+998)',
    flag: '🇺🇿',
    name: 'Uzbekistan',
  },
  {
    code: '+678',
    country: 'VU',
    label: '🇻🇺 Vanuatu (+678)',
    flag: '🇻🇺',
    name: 'Vanuatu',
  },
  {
    code: '+379',
    country: 'VA',
    label: '🇻🇦 Vatican City (+379)',
    flag: '🇻🇦',
    name: 'Vatican City',
  },
  {
    code: '+58',
    country: 'VE',
    label: '🇻🇪 Venezuela (+58)',
    flag: '🇻🇪',
    name: 'Venezuela',
  },
  {
    code: '+84',
    country: 'VN',
    label: '🇻🇳 Vietnam (+84)',
    flag: '🇻🇳',
    name: 'Vietnam',
  },
  {
    code: '+967',
    country: 'YE',
    label: '🇾🇪 Yemen (+967)',
    flag: '🇾🇪',
    name: 'Yemen',
  },
  {
    code: '+260',
    country: 'ZM',
    label: '🇿🇲 Zambia (+260)',
    flag: '🇿🇲',
    name: 'Zambia',
  },
  {
    code: '+263',
    country: 'ZW',
    label: '🇿🇼 Zimbabwe (+263)',
    flag: '🇿🇼',
    name: 'Zimbabwe',
  },
] as const;

// Type for country code entry
export type CountryCode = (typeof COUNTRY_CODES)[number];

// Default country code (Australia)
export const DEFAULT_COUNTRY_CODE = '+61';

/**
 * Parse E.164 phone number into country code and local number
 */
export function parsePhoneNumber(phone: string | null): {
  countryCode: string;
  localNumber: string;
  country: CountryCode | undefined;
} {
  if (!phone) {
    return {
      countryCode: DEFAULT_COUNTRY_CODE,
      localNumber: '',
      country: COUNTRY_CODES.find((c) => c.code === DEFAULT_COUNTRY_CODE),
    };
  }

  // Sort by code length (longest first) to match correctly
  // e.g., +1868 (Trinidad) should match before +1 (US)
  const sortedCodes = [...COUNTRY_CODES].sort(
    (a, b) => b.code.length - a.code.length
  );

  for (const country of sortedCodes) {
    if (phone.startsWith(country.code)) {
      const localNumber = phone.slice(country.code.length);
      return { countryCode: country.code, localNumber, country };
    }
  }

  // Default to Australia if no match
  return {
    countryCode: DEFAULT_COUNTRY_CODE,
    localNumber: phone.replace(/^\+/, ''),
    country: COUNTRY_CODES.find((c) => c.code === DEFAULT_COUNTRY_CODE),
  };
}

/**
 * Format phone number with spaces for readability
 * Uses generic formatting for most countries
 */
export function formatPhoneNumber(value: string, countryCode: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // Remove leading 0 if present (common convention)
  const cleanDigits = digits.startsWith('0') ? digits.slice(1) : digits;

  // Country-specific formatting
  switch (countryCode) {
    case '+61': // Australia: XXX XXX XXX
      if (cleanDigits.length <= 3) return cleanDigits;
      if (cleanDigits.length <= 6)
        return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3)}`;
      return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(
        3,
        6
      )} ${cleanDigits.slice(6, 9)}`;

    case '+1': // US/Canada: XXX XXX XXXX
      if (cleanDigits.length <= 3) return cleanDigits;
      if (cleanDigits.length <= 6)
        return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3)}`;
      return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(
        3,
        6
      )} ${cleanDigits.slice(6, 10)}`;

    case '+44': // UK: XXXX XXXXXX
      if (cleanDigits.length <= 4) return cleanDigits;
      return `${cleanDigits.slice(0, 4)} ${cleanDigits.slice(4, 10)}`;

    case '+64': // NZ: XX XXX XXXX
      if (cleanDigits.length <= 2) return cleanDigits;
      if (cleanDigits.length <= 5)
        return `${cleanDigits.slice(0, 2)} ${cleanDigits.slice(2)}`;
      return `${cleanDigits.slice(0, 2)} ${cleanDigits.slice(
        2,
        5
      )} ${cleanDigits.slice(5, 9)}`;

    case '+65': // Singapore: XXXX XXXX
      if (cleanDigits.length <= 4) return cleanDigits;
      return `${cleanDigits.slice(0, 4)} ${cleanDigits.slice(4, 8)}`;

    case '+91': // India: XXXXX XXXXX
      if (cleanDigits.length <= 5) return cleanDigits;
      return `${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5, 10)}`;

    case '+86': // China: XXX XXXX XXXX
      if (cleanDigits.length <= 3) return cleanDigits;
      if (cleanDigits.length <= 7)
        return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3)}`;
      return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(
        3,
        7
      )} ${cleanDigits.slice(7, 11)}`;

    case '+81': // Japan: XX XXXX XXXX
      if (cleanDigits.length <= 2) return cleanDigits;
      if (cleanDigits.length <= 6)
        return `${cleanDigits.slice(0, 2)} ${cleanDigits.slice(2)}`;
      return `${cleanDigits.slice(0, 2)} ${cleanDigits.slice(
        2,
        6
      )} ${cleanDigits.slice(6, 10)}`;

    case '+82': // South Korea: XX XXXX XXXX
      if (cleanDigits.length <= 2) return cleanDigits;
      if (cleanDigits.length <= 6)
        return `${cleanDigits.slice(0, 2)} ${cleanDigits.slice(2)}`;
      return `${cleanDigits.slice(0, 2)} ${cleanDigits.slice(
        2,
        6
      )} ${cleanDigits.slice(6, 10)}`;

    case '+49': // Germany: XXX XXXXXXXX
      if (cleanDigits.length <= 3) return cleanDigits;
      return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3, 11)}`;

    case '+33': // France: X XX XX XX XX
      if (cleanDigits.length <= 1) return cleanDigits;
      let formatted = cleanDigits.slice(0, 1);
      for (let i = 1; i < cleanDigits.length && i < 9; i += 2) {
        formatted +=
          ' ' + cleanDigits.slice(i, Math.min(i + 2, cleanDigits.length));
      }
      return formatted;

    default:
      // Generic format: groups of 3-4 digits
      if (cleanDigits.length <= 4) return cleanDigits;
      if (cleanDigits.length <= 7)
        return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3)}`;
      if (cleanDigits.length <= 10)
        return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(
          3,
          6
        )} ${cleanDigits.slice(6)}`;
      return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(
        3,
        6
      )} ${cleanDigits.slice(6, 10)} ${cleanDigits.slice(10)}`;
  }
}

/**
 * Get placeholder for phone input based on country
 */
export function getPhonePlaceholder(countryCode: string): string {
  switch (countryCode) {
    case '+61':
      return '412 345 678';
    case '+1':
      return '555 123 4567';
    case '+44':
      return '7911 123456';
    case '+64':
      return '21 123 4567';
    case '+65':
      return '9123 4567';
    case '+91':
      return '98765 43210';
    case '+86':
      return '139 1234 5678';
    case '+81':
      return '90 1234 5678';
    case '+82':
      return '10 1234 5678';
    case '+49':
      return '151 12345678';
    case '+33':
      return '6 12 34 56 78';
    default:
      return '123 456 7890';
  }
}

/**
 * Get maximum length for phone input (digits only) based on country
 */
export function getPhoneMaxLength(countryCode: string): number {
  switch (countryCode) {
    case '+61':
      return 9; // Australia
    case '+1':
      return 10; // US/Canada
    case '+44':
      return 10; // UK
    case '+64':
      return 9; // New Zealand
    case '+65':
      return 8; // Singapore
    case '+91':
      return 10; // India
    case '+86':
      return 11; // China
    case '+81':
      return 10; // Japan
    case '+82':
      return 10; // South Korea
    case '+49':
      return 11; // Germany
    case '+33':
      return 9; // France
    default:
      return 15; // Generic max
  }
}

/**
 * Validate phone number (basic validation)
 * Returns null if valid, error message if invalid
 */
export function validatePhoneNumber(
  phone: string,
  countryCode: string,
  required: boolean = false
): string | null {
  const digits = phone.replace(/\D/g, '');
  const cleanDigits = digits.startsWith('0') ? digits.slice(1) : digits;

  // If not required and empty, it's valid
  if (!required && cleanDigits.length === 0) {
    return null;
  }

  // If required and empty
  if (required && cleanDigits.length === 0) {
    return 'Phone number is required';
  }

  // Minimum length check (at least 6 digits for any country)
  if (cleanDigits.length > 0 && cleanDigits.length < 6) {
    return 'Phone number is too short';
  }

  // Country-specific validation
  const maxLength = getPhoneMaxLength(countryCode);
  if (cleanDigits.length > maxLength) {
    return `Phone number is too long (max ${maxLength} digits)`;
  }

  // Australian mobile validation
  if (
    countryCode === '+61' &&
    cleanDigits.length > 0 &&
    !cleanDigits.startsWith('4')
  ) {
    return 'Australian mobile numbers must start with 4';
  }

  return null;
}

/**
 * Format phone number to E.164 format for storage
 */
export function toE164(phone: string, countryCode: string): string {
  const digits = phone.replace(/\D/g, '');
  const cleanDigits = digits.startsWith('0') ? digits.slice(1) : digits;
  return `${countryCode}${cleanDigits}`;
}

/**
 * Get display format for a stored E.164 phone number
 */
export function formatStoredPhone(phone: string | null): string {
  if (!phone) return '';

  const { countryCode, localNumber, country } = parsePhoneNumber(phone);
  const formatted = formatPhoneNumber(localNumber, countryCode);

  return country
    ? `${country.flag} ${countryCode} ${formatted}`
    : `${countryCode} ${formatted}`;
}
