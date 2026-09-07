// Build-time only. Windows resource update APIs preserve unrelated PE resources.
// https://learn.microsoft.com/windows/win32/api/winbase/nf-winbase-updateresourcew
using System;
using System.IO;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public static class StudioExecutableIcon {
    delegate bool NameCallback(IntPtr module, IntPtr type, IntPtr name, IntPtr parameter);
    delegate bool LanguageCallback(IntPtr module, IntPtr type, IntPtr name, ushort language, IntPtr parameter);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryEx(string file, IntPtr handle, uint flags);
    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumResourceNames(IntPtr module, IntPtr type, NameCallback callback, IntPtr parameter);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumResourceLanguages(IntPtr module, IntPtr type, IntPtr name, LanguageCallback callback, IntPtr parameter);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr BeginUpdateResource(string file, bool deleteExisting);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool UpdateResource(IntPtr update, IntPtr type, IntPtr name, ushort language, byte[] data, uint size);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EndUpdateResource(IntPtr update, bool discard);
    sealed class Group { public ushort Id; public ushort Language; }
    static void Check(bool success) { if(!success) throw new Win32Exception(Marshal.GetLastWin32Error()); }

    static byte[] Block(string key, ushort type, ushort valueLength, byte[] value, params byte[][] children) {
        using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)) {
            writer.Write((ushort)0);writer.Write(valueLength);writer.Write(type);writer.Write(Encoding.Unicode.GetBytes(key+"\0"));
            while(stream.Length%4!=0)writer.Write((byte)0);
            writer.Write(value);
            foreach(var child in children){while(stream.Length%4!=0)writer.Write((byte)0);writer.Write(child);}
            if(stream.Length>65535)throw new InvalidDataException("Version resource too large.");
            stream.Position=0;writer.Write((ushort)stream.Length);return stream.ToArray();
        }
    }
    static byte[] VersionInfo(string executable,string version) {
        var original=FileVersionInfo.GetVersionInfo(executable);var v=new Version(version);
        uint ms=((uint)v.Major<<16)|(uint)v.Minor,ls=((uint)Math.Max(0,v.Build)<<16)|(uint)Math.Max(0,v.Revision);
        byte[] fixedInfo;using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){
            foreach(uint word in new uint[]{0xfeef04bd,0x10000,ms,ls,ms,ls,0x3f,0,0x40004,1,0,0,0})writer.Write(word);
            fixedInfo=stream.ToArray();
        }
        var strings=new List<byte[]>();
        var values=new Dictionary<string,string>{{"FileDescription","MML Music Studio"},{"ProductName","MML Music Studio"},{"InternalName","MML Music Studio"},{"OriginalFilename","MML Music Studio.exe"},{"FileVersion",version},{"ProductVersion",version},{"LegalCopyright",original.LegalCopyright??""}};
        foreach(var entry in values)strings.Add(Block(entry.Key,1,(ushort)(entry.Value.Length+1),Encoding.Unicode.GetBytes(entry.Value+"\0")));
        return Block("VS_VERSION_INFO",0,52,fixedInfo,
            Block("StringFileInfo",1,0,new byte[0],Block("040904B0",1,0,new byte[0],strings.ToArray())),
            Block("VarFileInfo",1,0,new byte[0],Block("Translation",0,4,new byte[]{9,4,176,4})));
    }
    public static void Apply(string executable, string icon, string version) {
        byte[] versionInfo=VersionInfo(executable,version);
        byte[] ico=File.ReadAllBytes(icon);
        if(ico.Length<6 || BitConverter.ToUInt16(ico,0)!=0 || BitConverter.ToUInt16(ico,2)!=1) throw new InvalidDataException("Invalid ICO header.");
        int count=BitConverter.ToUInt16(ico,4);
        if(count==0 || count>255 || ico.Length<6+16*count) throw new InvalidDataException("Invalid ICO entries.");
        var images=new List<byte[]>();
        byte[] group=new byte[6+14*count];Array.Copy(ico,group,6);
        for(int i=0;i<count;i++) {
            int entry=6+i*16;uint size=BitConverter.ToUInt32(ico,entry+8),offset=BitConverter.ToUInt32(ico,entry+12);
            if(size==0 || offset<6+16*count || (ulong)offset+size>(ulong)ico.Length) throw new InvalidDataException("Invalid ICO image.");
            byte[] image=new byte[size];Array.Copy(ico,(long)offset,image,0,(long)size);images.Add(image);
            Array.Copy(ico,entry,group,6+i*14,12);
            // Separate IDs avoid replacing unrelated icon resources.
            Array.Copy(BitConverter.GetBytes((ushort)(40000+i)),0,group,6+i*14+12,2);
        }
        var groups=new List<Group>();var versions=new List<Group>();
        IntPtr module=LoadLibraryEx(executable,IntPtr.Zero,2);if(module==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
        bool unsupported=false,languageFailure=false;
        try {
            Check(EnumResourceNames(module,(IntPtr)16,delegate(IntPtr m,IntPtr t,IntPtr n,IntPtr unused) {
                if(n.ToInt64()>65535)return false;
                return EnumResourceLanguages(m,t,n,delegate(IntPtr mm,IntPtr tt,IntPtr nn,ushort language,IntPtr arg){versions.Add(new Group {Id=(ushort)n.ToInt64(),Language=language});return true;},IntPtr.Zero);
            },IntPtr.Zero));
            Check(EnumResourceNames(module,(IntPtr)14,delegate(IntPtr m,IntPtr t,IntPtr n,IntPtr unused) {
                if(n.ToInt64()>65535){unsupported=true;return false;}
                bool ok=EnumResourceLanguages(m,t,n,delegate(IntPtr mm,IntPtr tt,IntPtr nn,ushort language,IntPtr arg) {
                    groups.Add(new Group { Id=(ushort)n.ToInt64(), Language=language });return true;
                },IntPtr.Zero);
                languageFailure|=!ok;return ok;
            },IntPtr.Zero));
        } finally { FreeLibrary(module); }
        if(unsupported || languageFailure || groups.Count==0)throw new InvalidDataException("Unsupported executable icon resources.");
        IntPtr update=BeginUpdateResource(executable,false);if(update==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
        bool committed=false;
        try {
            var languages=new HashSet<ushort>();
            foreach(var target in groups) {
                if(languages.Add(target.Language))for(int i=0;i<count;i++)Check(UpdateResource(update,(IntPtr)3,(IntPtr)(40000+i),target.Language,images[i],(uint)images[i].Length));
                Check(UpdateResource(update,(IntPtr)14,(IntPtr)target.Id,target.Language,group,(uint)group.Length));
            }
            foreach(var target in versions)Check(UpdateResource(update,(IntPtr)16,(IntPtr)target.Id,target.Language,versionInfo,(uint)versionInfo.Length));
            Check(EndUpdateResource(update,false));committed=true;
        } finally { if(!committed)EndUpdateResource(update,true); }
    }
}
