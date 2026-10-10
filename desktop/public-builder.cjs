module.exports = {
  appId:'cn.negotiation.public', productName:'外贸谈判公开体验版',
  extraMetadata:{name:'foreign-trade-public', version:'0.2.0', publicEdition:true,
    description:'外贸谈判公开体验版：用户自配 Key'},
  files:['*.cjs','public-settings.html','public-settings.js','package.json',
    '!*.test.cjs','!inject*','!public-builder.cjs'],
  extraResources:[{from:'../build/desktop-backend/negotiation-backend',to:'backend'},
    {from:'../build/public-notices',to:'notices'}],
  directories:{output:'../public-release/windows-x64'},
  win:{target:[{target:'nsis',arch:['x64']}],artifactName:'ForeignTradePublic-${version}-win-${arch}-setup.${ext}',signAndEditExecutable:false},
  nsis:{oneClick:true,perMachine:false,allowElevation:false,createDesktopShortcut:'always',deleteAppDataOnUninstall:false},
}
