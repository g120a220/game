# Use only the Windows-configured proxy and current Windows identity.
# Never send default credentials to the destination web server or save passwords.
function Get-AcademySystemProxy {
    param([Parameter(Mandatory=$true)][uri]$Uri)
    $proxy = [System.Net.WebRequest]::GetSystemWebProxy()
    if ($null -eq $proxy -or $proxy.IsBypassed($Uri)) { return $null }
    $address = $proxy.GetProxy($Uri)
    if ($null -eq $address -or $address.AbsoluteUri -eq $Uri.AbsoluteUri) { return $null }
    return $address
}
function Save-AcademyDownload {
    param([Parameter(Mandatory=$true)][uri]$Uri,[Parameter(Mandatory=$true)][string]$OutFile)
    if ($Uri.Scheme -ne 'https') { throw 'Downloads require HTTPS.' }
    $previousProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    $previousProtocol = [Net.ServicePointManager]::SecurityProtocol
    try {
        [Net.ServicePointManager]::SecurityProtocol = $previousProtocol -bor [Net.SecurityProtocolType]::Tls12
        $proxy = Get-AcademySystemProxy -Uri $Uri
        if ($null -ne $proxy) {
            Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $OutFile -Proxy $proxy.AbsoluteUri -ProxyUseDefaultCredentials -TimeoutSec 120 | Out-Null
        } else {
            Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $OutFile -TimeoutSec 120 | Out-Null
        }
    } catch {
        $status = $null
        if ($null -ne $_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq 407) {
            throw 'Company proxy rejected Windows sign-in (407). Ask IT to allow nodejs.org and registry.npmjs.org, or use an IT-approved network. Do not put passwords in these files.'
        }
        throw
    } finally {
        [Net.ServicePointManager]::SecurityProtocol = $previousProtocol
        $ProgressPreference = $previousProgress
    }
}
